-- Add assignee support and extend calendar event types
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS assigned_personnel TEXT DEFAULT '';

ALTER TABLE public.calendar_events
  ALTER COLUMN type SET DEFAULT 'Meeting';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'calendar_events'
      AND constraint_name = 'calendar_events_type_check'
  ) THEN
    ALTER TABLE public.calendar_events DROP CONSTRAINT calendar_events_type_check;
  END IF;
END $$;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_type_check
  CHECK (type IN (
    'Deadline',
    'Meeting',
    'Review',
    'Briefing',
    'Training/Workshop',
    'Leave',
    'Hearing',
    'Seminar',
    'Announcement'
  ));
