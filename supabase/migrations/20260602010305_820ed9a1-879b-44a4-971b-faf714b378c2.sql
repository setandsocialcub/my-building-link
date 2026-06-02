-- Forum threads
CREATE TABLE public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  author_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('building_updates','lost_and_found','recommendations','for_sale_free','feedback')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_threads TO authenticated;
GRANT ALL ON public.forum_threads TO service_role;

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members read threads"
  ON public.forum_threads FOR SELECT TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Residents create threads in their building"
  ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_resident_of_building(building_id)
    AND author_id = public.current_resident_id(building_id)
  );

CREATE POLICY "Author or manager updates thread"
  ON public.forum_threads FOR UPDATE TO authenticated
  USING (
    author_id = public.current_resident_id(building_id)
    OR public.is_manager_of_building(building_id)
  )
  WITH CHECK (
    author_id = public.current_resident_id(building_id)
    OR public.is_manager_of_building(building_id)
  );

CREATE POLICY "Author or manager deletes thread"
  ON public.forum_threads FOR DELETE TO authenticated
  USING (
    author_id = public.current_resident_id(building_id)
    OR public.is_manager_of_building(building_id)
  );

CREATE INDEX idx_forum_threads_building ON public.forum_threads(building_id, created_at DESC);

-- Forum replies
CREATE TABLE public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  building_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_replies TO authenticated;
GRANT ALL ON public.forum_replies TO service_role;

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Building members read replies"
  ON public.forum_replies FOR SELECT TO authenticated
  USING (public.has_building_access(building_id));

CREATE POLICY "Residents reply to unlocked threads"
  ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (
    public.is_resident_of_building(building_id)
    AND author_id = public.current_resident_id(building_id)
    AND EXISTS (
      SELECT 1 FROM public.forum_threads t
      WHERE t.id = thread_id AND t.building_id = forum_replies.building_id AND t.is_locked = false
    )
  );

CREATE POLICY "Author or manager deletes reply"
  ON public.forum_replies FOR DELETE TO authenticated
  USING (
    author_id = public.current_resident_id(building_id)
    OR public.is_manager_of_building(building_id)
  );

CREATE INDEX idx_forum_replies_thread ON public.forum_replies(thread_id, created_at ASC);

-- Maintain reply_count
CREATE OR REPLACE FUNCTION public.bump_forum_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads SET reply_count = reply_count + 1, updated_at = now() WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER forum_replies_count_ins
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_forum_reply_count();

CREATE TRIGGER forum_replies_count_del
  AFTER DELETE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_forum_reply_count();

-- Extend message_flags to support forum content
ALTER TABLE public.message_flags ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'channel_message';
ALTER TABLE public.message_flags ALTER COLUMN channel_id DROP NOT NULL;