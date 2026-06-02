-- Direct messages between connected residents
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_messages_connection_created ON public.direct_messages(connection_id, created_at DESC);
CREATE INDEX idx_direct_messages_recipient_unread ON public.direct_messages(recipient_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Participants (by resident_profile id) can read messages on accepted connections they belong to
CREATE POLICY "Participants read messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (
  public.is_my_profile(sender_id) OR public.is_my_profile(recipient_id)
);

CREATE POLICY "Sender sends messages on accepted connection"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_my_profile(sender_id)
  AND EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.id = connection_id
      AND c.status = 'accepted'
      AND (
        (c.requester_id = sender_id AND c.addressee_id = recipient_id)
        OR (c.addressee_id = sender_id AND c.requester_id = recipient_id)
      )
  )
);

-- Recipient can mark their messages as read
CREATE POLICY "Recipient updates read status"
ON public.direct_messages FOR UPDATE TO authenticated
USING (public.is_my_profile(recipient_id))
WITH CHECK (public.is_my_profile(recipient_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;