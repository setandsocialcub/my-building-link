
-- Community Voice: submissions, updates thread, staff recognitions
CREATE TYPE public.community_voice_type AS ENUM (
  'concern','safety','maintenance','improvement','event_suggestion','recognition','general_feedback'
);

CREATE TYPE public.community_voice_priority AS ENUM (
  'general','low','medium','high','urgent'
);

CREATE TYPE public.community_voice_status AS ENUM (
  'received','viewed','in_progress','resolved','closed'
);

CREATE TABLE public.community_voice_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  submitter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  submission_type public.community_voice_type NOT NULL,
  category text,
  priority public.community_voice_priority NOT NULL DEFAULT 'general',
  subject text NOT NULL,
  description text NOT NULL,
  attachment_urls text[] NOT NULL DEFAULT '{}',
  recognized_staff_name text,
  status public.community_voice_status NOT NULL DEFAULT 'received',
  assigned_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_viewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_cv_building_created ON public.community_voice_submissions(building_id, created_at DESC);
CREATE INDEX ix_cv_status ON public.community_voice_submissions(building_id, status);
CREATE INDEX ix_cv_submitter ON public.community_voice_submissions(submitter_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_voice_submissions TO authenticated;
GRANT ALL ON public.community_voice_submissions TO service_role;

ALTER TABLE public.community_voice_submissions ENABLE ROW LEVEL SECURITY;

-- Residents: insert into their own building; read their own (even anonymous — via submitter_id)
CREATE POLICY "residents insert own submissions"
ON public.community_voice_submissions FOR INSERT TO authenticated
WITH CHECK (
  public.is_resident_of_building(building_id)
  AND submitter_id = auth.uid()
);

CREATE POLICY "submitters read own submissions"
ON public.community_voice_submissions FOR SELECT TO authenticated
USING (submitter_id = auth.uid());

-- Managers/admins read + update all submissions for their building
CREATE POLICY "managers read building submissions"
ON public.community_voice_submissions FOR SELECT TO authenticated
USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "managers update building submissions"
ON public.community_voice_submissions FOR UPDATE TO authenticated
USING (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.is_manager_of_building(building_id) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_cv_updated_at
BEFORE UPDATE ON public.community_voice_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Thread: manager replies and status change notes
CREATE TABLE public.community_voice_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.community_voice_submissions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('manager','resident','system')),
  body text NOT NULL,
  new_status public.community_voice_status,
  visible_to_resident boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_cv_updates_submission ON public.community_voice_updates(submission_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_voice_updates TO authenticated;
GRANT ALL ON public.community_voice_updates TO service_role;

ALTER TABLE public.community_voice_updates ENABLE ROW LEVEL SECURITY;

-- Read: manager of the submission's building OR the submitter (only visible_to_resident=true)
CREATE POLICY "read updates as manager"
ON public.community_voice_updates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_voice_submissions s
    WHERE s.id = submission_id
      AND (public.is_manager_of_building(s.building_id) OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "read updates as submitter"
ON public.community_voice_updates FOR SELECT TO authenticated
USING (
  visible_to_resident = true
  AND EXISTS (
    SELECT 1 FROM public.community_voice_submissions s
    WHERE s.id = submission_id AND s.submitter_id = auth.uid()
  )
);

-- Insert: manager of building can post; submitter can reply
CREATE POLICY "managers post updates"
ON public.community_voice_updates FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role IN ('manager','system')
  AND EXISTS (
    SELECT 1 FROM public.community_voice_submissions s
    WHERE s.id = submission_id
      AND (public.is_manager_of_building(s.building_id) OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "residents post updates"
ON public.community_voice_updates FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role = 'resident'
  AND EXISTS (
    SELECT 1 FROM public.community_voice_submissions s
    WHERE s.id = submission_id AND s.submitter_id = auth.uid()
  )
);

-- Trigger: notify managers on new submission via existing notifications table
CREATE OR REPLACE FUNCTION public.notify_managers_of_community_voice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mgr record;
  priority_emoji text;
  type_label text;
BEGIN
  priority_emoji := CASE NEW.priority
    WHEN 'urgent' THEN '🚨'
    WHEN 'high' THEN '⚠️'
    WHEN 'medium' THEN '🔔'
    ELSE '💬'
  END;
  type_label := CASE NEW.submission_type
    WHEN 'concern' THEN 'Community Concern'
    WHEN 'safety' THEN 'Safety Issue'
    WHEN 'maintenance' THEN 'Maintenance Observation'
    WHEN 'improvement' THEN 'Improvement Suggestion'
    WHEN 'event_suggestion' THEN 'Event Suggestion'
    WHEN 'recognition' THEN 'Staff Recognition'
    ELSE 'Feedback'
  END;

  FOR mgr IN
    SELECT rp.id AS recipient_profile_id
    FROM public.property_managers pm
    LEFT JOIN public.resident_profiles rp
      ON rp.user_id = pm.user_id AND rp.building_id = pm.building_id
    WHERE pm.building_id = NEW.building_id
      AND pm.user_id IS NOT NULL
      AND rp.id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (building_id, recipient_id, message)
    VALUES (
      NEW.building_id,
      mgr.recipient_profile_id,
      priority_emoji || ' New Community Voice: ' || type_label ||
        CASE WHEN NEW.category IS NOT NULL THEN ' — ' || NEW.category ELSE '' END
    );
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_cv_notify_managers
AFTER INSERT ON public.community_voice_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_managers_of_community_voice();

-- Notify submitter when manager posts a visible update or status changes
CREATE OR REPLACE FUNCTION public.notify_submitter_of_voice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub record;
  recip_profile uuid;
  status_label text;
BEGIN
  IF NEW.author_role <> 'manager' AND NEW.author_role <> 'system' THEN
    RETURN NEW;
  END IF;
  IF NOT NEW.visible_to_resident THEN
    RETURN NEW;
  END IF;

  SELECT * INTO sub FROM public.community_voice_submissions WHERE id = NEW.submission_id;
  IF sub.submitter_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO recip_profile FROM public.resident_profiles
   WHERE user_id = sub.submitter_id AND building_id = sub.building_id LIMIT 1;
  IF recip_profile IS NULL THEN RETURN NEW; END IF;

  status_label := CASE NEW.new_status
    WHEN 'viewed' THEN '👀 Management viewed your submission'
    WHEN 'in_progress' THEN '🔄 Management is working on your submission'
    WHEN 'resolved' THEN '✅ Your submission was resolved'
    WHEN 'closed' THEN 'Your submission has been closed'
    ELSE '💬 Management responded to your Community Voice'
  END;

  INSERT INTO public.notifications (building_id, recipient_id, message)
  VALUES (sub.building_id, recip_profile, status_label);

  RETURN NEW;
END $$;

CREATE TRIGGER trg_cv_notify_submitter
AFTER INSERT ON public.community_voice_updates
FOR EACH ROW EXECUTE FUNCTION public.notify_submitter_of_voice_update();

-- When status transitions, stamp timestamps
CREATE OR REPLACE FUNCTION public.stamp_voice_submission_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'viewed' AND NEW.first_viewed_at IS NULL THEN
      NEW.first_viewed_at := now();
    END IF;
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cv_stamp_status
BEFORE UPDATE ON public.community_voice_submissions
FOR EACH ROW EXECUTE FUNCTION public.stamp_voice_submission_status();

-- Feature flag column on building_settings
ALTER TABLE public.building_settings
  ADD COLUMN IF NOT EXISTS enable_community_voice boolean NOT NULL DEFAULT true;
