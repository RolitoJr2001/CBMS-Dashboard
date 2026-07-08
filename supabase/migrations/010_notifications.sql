-- Production-ready notifications for CBMS dashboard
-- Stores recipient-aware, role-based notifications in Supabase and supports realtime sync.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  actor_role text,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT 'General',
  type text NOT NULL DEFAULT 'activity',
  entity_id uuid,
  entity_type text,
  action text NOT NULL DEFAULT 'system_message',
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_name text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_role text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'system_message';

ALTER TABLE public.notifications
  ALTER COLUMN type SET DEFAULT 'activity';

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(read, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_entity_idx ON public.notifications(entity_type, entity_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications for themselves or others" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_id IS NOT NULL
  );

CREATE POLICY "Users can update own notification read state"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());
