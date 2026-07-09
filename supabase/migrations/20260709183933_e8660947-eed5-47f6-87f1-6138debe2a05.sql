
-- 1. Extend submissions
ALTER TABLE public.community_voice_submissions
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sentiment text CHECK (sentiment IN ('positive','neutral','negative')),
  ADD COLUMN IF NOT EXISTS sentiment_score numeric;

CREATE INDEX IF NOT EXISTS ix_cv_escalation
  ON public.community_voice_submissions (building_id, status, priority, last_escalated_at);

-- 2. Escalation config
CREATE TABLE IF NOT EXISTS public.community_voice_escalation_config (
  building_id uuid PRIMARY KEY REFERENCES public.buildings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  urgent_minutes integer NOT NULL DEFAULT 15,
  high_minutes integer NOT NULL DEFAULT 60,
  medium_minutes integer NOT NULL DEFAULT 240,
  low_minutes integer NOT NULL DEFAULT 1440,
  max_escalations integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_voice_escalation_config TO authenticated;
GRANT ALL ON public.community_voice_escalation_config TO service_role;

ALTER TABLE public.community_voice_escalation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers read escalation config"
  ON public.community_voice_escalation_config FOR SELECT
  TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "managers write escalation config"
  ON public.community_voice_escalation_config FOR ALL
  TO authenticated
  USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cv_esc_updated_at BEFORE UPDATE
  ON public.community_voice_escalation_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed config for existing buildings
INSERT INTO public.community_voice_escalation_config (building_id)
SELECT id FROM public.buildings
ON CONFLICT (building_id) DO NOTHING;

-- Auto-create config for new buildings
CREATE OR REPLACE FUNCTION public.create_default_escalation_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_voice_escalation_config (building_id) VALUES (NEW.id)
  ON CONFLICT (building_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_default_escalation_config ON public.buildings;
CREATE TRIGGER trg_default_escalation_config AFTER INSERT ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.create_default_escalation_config();

-- 3. Escalation engine
CREATE OR REPLACE FUNCTION public.escalate_stale_voice_submissions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record;
  cfg record;
  window_minutes integer;
  ref_time timestamptz;
  escalated_count integer := 0;
  mgr record;
BEGIN
  FOR s IN
    SELECT * FROM public.community_voice_submissions
    WHERE status IN ('received','viewed','in_progress')
      AND priority IN ('urgent','high','medium','low')
  LOOP
    SELECT * INTO cfg FROM public.community_voice_escalation_config WHERE building_id = s.building_id;
    IF NOT FOUND OR NOT cfg.enabled THEN CONTINUE; END IF;
    IF s.escalation_level >= cfg.max_escalations THEN CONTINUE; END IF;

    window_minutes := CASE s.priority
      WHEN 'urgent' THEN cfg.urgent_minutes
      WHEN 'high'   THEN cfg.high_minutes
      WHEN 'medium' THEN cfg.medium_minutes
      WHEN 'low'    THEN cfg.low_minutes
      ELSE NULL END;
    IF window_minutes IS NULL THEN CONTINUE; END IF;

    ref_time := COALESCE(s.last_escalated_at, s.created_at);
    IF now() - ref_time < make_interval(mins => window_minutes) THEN CONTINUE; END IF;

    UPDATE public.community_voice_submissions
       SET escalation_level = escalation_level + 1,
           last_escalated_at = now()
     WHERE id = s.id;

    INSERT INTO public.community_voice_updates
      (submission_id, author_role, body, new_status, visible_to_resident)
    VALUES
      (s.id, 'system',
       '⏰ Auto-escalated: no acknowledgement within the ' || s.priority || ' priority window (' || window_minutes || ' min). Escalation level: ' || (s.escalation_level + 1) || '.',
       NULL, false);

    FOR mgr IN
      SELECT rp.id AS recipient_profile_id
      FROM public.property_managers pm
      LEFT JOIN public.resident_profiles rp
        ON rp.user_id = pm.user_id AND rp.building_id = pm.building_id
      WHERE pm.building_id = s.building_id
        AND pm.user_id IS NOT NULL
        AND rp.id IS NOT NULL
    LOOP
      INSERT INTO public.notifications (building_id, recipient_id, message)
      VALUES (s.building_id, mgr.recipient_profile_id,
        '🚨 ESCALATED (L' || (s.escalation_level + 1) || '): ' || s.subject);
    END LOOP;

    escalated_count := escalated_count + 1;
  END LOOP;
  RETURN escalated_count;
END $$;

-- 4. Schedule every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
  PERFORM cron.unschedule('community-voice-escalation');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'community-voice-escalation',
  '*/5 * * * *',
  $cron$ SELECT public.escalate_stale_voice_submissions(); $cron$
);
