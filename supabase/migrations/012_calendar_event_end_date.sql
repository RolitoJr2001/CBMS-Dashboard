-- Support multi-day events (e.g. "July 20-23, 2026") in Schedule & Events.
-- `date` continues to be treated as the event's start date; `end_date` is
-- new and nullable so existing single-day events remain valid without a
-- backfill. The app treats a missing end_date as "same day as start".

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS end_date date;

-- Keep end_date >= date whenever both are present.
ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_end_date_check;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_end_date_check
  CHECK (end_date IS NULL OR end_date >= date);

CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON public.calendar_events(end_date);
