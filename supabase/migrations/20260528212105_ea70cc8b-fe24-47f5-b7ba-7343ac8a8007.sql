-- CHANNELS
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  interest_tag text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_channels_building ON public.channels(building_id);

GRANT SELECT, INSERT ON public.channels TO anon, authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read channels" ON public.channels FOR SELECT TO public USING (true);
CREATE POLICY "Public create channels" ON public.channels FOR INSERT TO public WITH CHECK (true);

-- CHANNEL MEMBERS
CREATE TABLE public.channel_members (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, profile_id)
);
CREATE INDEX idx_channel_members_profile ON public.channel_members(profile_id);

GRANT SELECT, INSERT, DELETE ON public.channel_members TO anon, authenticated;
GRANT ALL ON public.channel_members TO service_role;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read members" ON public.channel_members FOR SELECT TO public USING (true);
CREATE POLICY "Public add members" ON public.channel_members FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public remove members" ON public.channel_members FOR DELETE TO public USING (true);

-- MESSAGES
CREATE TABLE public.channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_channel_messages_channel ON public.channel_messages(channel_id, created_at);

GRANT SELECT, INSERT ON public.channel_messages TO anon, authenticated;
GRANT ALL ON public.channel_messages TO service_role;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read messages" ON public.channel_messages FOR SELECT TO public USING (true);
CREATE POLICY "Public send messages" ON public.channel_messages FOR INSERT TO public WITH CHECK (true);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.resident_profiles(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, read, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read notifications" ON public.notifications FOR SELECT TO public USING (true);
CREATE POLICY "Public create notifications" ON public.notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public update notifications" ON public.notifications FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.channel_messages REPLICA IDENTITY FULL;
ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;