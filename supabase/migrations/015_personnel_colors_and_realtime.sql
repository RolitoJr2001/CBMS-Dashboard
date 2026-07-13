-- ============================================================
-- Migration 015: Personnel Color Chips + Real-Time Synchronization
-- ============================================================
-- Run this in Supabase SQL Editor → New query. This migration is
-- ADDITIVE ONLY — it does not touch or remove any existing column,
-- table, row, or policy.
--
-- Covers two features:
--
--   1. Customizable Personnel Colors
--      Adds a nullable `color` column to `public.personnel` so an
--      Administrator can assign each person a specific hex color
--      (e.g. "#2563eb") that's used for that person's chip everywhere
--      in the app (Task cards, Document assignments, Schedule &
--      Events, Activity Logs/Notifications, Remarks history). When
--      `color` is NULL (the default — nothing to migrate, existing
--      rows are unaffected), the frontend falls back to its existing
--      deterministic hash-based color, so nothing regresses for
--      personnel who haven't been assigned a custom color yet.
--
--   2. Real-Time Synchronization
--      Supabase only pushes realtime `postgres_changes` events for
--      tables that are explicitly part of the `supabase_realtime`
--      publication (see migration 013 for the same fix applied to
--      `notifications` and `tasks`). This migration extends that to
--      every table that now needs to sync live without a page refresh:
--      `remarks` (chat-style remarks), `calendar_events` (Schedule &
--      Events), `documents` (Document assignments/tracking), and
--      `personnel` (color/name changes). `requirements` is included
--      too for completeness/consistency across modules.
-- ============================================================


-- ─── 1. Customizable Personnel Colors ──────────────────────────

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS color TEXT;

-- Loosely validate the stored value so the column can only ever hold a
-- 6-digit hex color (e.g. "#2563eb") or be left NULL ("use the default
-- hash-based color"). This matches exactly what the color picker in
-- Personnel Manager sends.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'personnel'
      AND constraint_name = 'personnel_color_format_check'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_color_format_check
      CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$');
  END IF;
END $$;

COMMENT ON COLUMN public.personnel.color IS
  'Administrator-picked hex color (e.g. #2563eb) used for this person''s chip everywhere in the app. NULL = fall back to the deterministic hash-based color.';


-- ─── 2. Real-Time Synchronization ───────────────────────────────
-- REPLICA IDENTITY FULL ensures UPDATE/DELETE realtime payloads include
-- full row data (not just the primary key), which the frontend's
-- postgres_changes handlers rely on to update local state correctly
-- (e.g. reflecting a color change or a remark's full content instantly).

ALTER TABLE public.remarks         REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER TABLE public.documents       REPLICA IDENTITY FULL;
ALTER TABLE public.requirements    REPLICA IDENTITY FULL;
ALTER TABLE public.personnel       REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'remarks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.remarks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'requirements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requirements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'personnel'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.personnel;
  END IF;
END $$;

-- ─── No data migration needed ───────────────────────────────────
-- `color` is nullable and every existing personnel row already works
-- today via the hash-based fallback in src/utils/personnelColors.js,
-- so there is nothing to backfill.
