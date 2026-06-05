
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS title text;

CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX idx_announcement_reads_user ON public.announcement_reads(user_id);

GRANT SELECT, INSERT, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reads for accessible building"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = announcement_id AND public.has_building_access(a.building_id)
  ));

CREATE POLICY "Users record their own reads"
  ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND public.has_building_access(a.building_id)
    )
  );

CREATE POLICY "Users delete their own reads"
  ON public.announcement_reads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Fan out notifications to all residents on new announcement
CREATE OR REPLACE FUNCTION public.notify_residents_of_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (building_id, recipient_id, message)
  SELECT NEW.building_id, rp.id,
    COALESCE('📣 ' || NEW.title, '📣 New announcement from Building Management')
  FROM public.resident_profiles rp
  WHERE rp.building_id = NEW.building_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_announcement_notify ON public.announcements;
CREATE TRIGGER trg_announcement_notify
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_residents_of_announcement();
