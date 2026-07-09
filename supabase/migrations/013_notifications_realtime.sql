-- Root cause fix for "assigned personnel don't receive notifications":
-- the notifications table was never added to Supabase's `supabase_realtime`
-- publication. The app's subscribeToNotifications() (src/services/
-- notificationService.js) listens for postgres_changes on public.notifications,
-- but Supabase only pushes realtime events for tables that are explicitly
-- part of that publication. Without this, a notification row is inserted
-- correctly (visible on next manual reload / fetchNotifications call), but
-- an assignee who already has the dashboard open never sees it arrive live
-- — which reads exactly like "notifications don't work".
--
-- REPLICA IDENTITY FULL ensures UPDATE/DELETE payloads include full row
-- data (needed for the mark-as-read / delete realtime handlers in
-- AppContext to update local state correctly).

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- The app also subscribes to realtime changes on public.tasks
-- (AppContext.jsx "tasks-realtime" channel) so that task updates/
-- assignments made by an admin show up live for the assignee without a
-- manual refresh. Same gap, same fix.
ALTER TABLE public.tasks REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;
END $$;
