-- ============================================================
-- Migration 014: Remarks History (chat-style)
-- ============================================================
-- Feature: "Remarks History" — every remarks input field in the
-- system (Tasks, Document Tracking) must stop overwriting the
-- previous remark and instead keep every remark as its own record,
-- displayed like a conversation (user, date/time, content).
--
-- This migration is ADDITIVE ONLY:
--   - It creates a brand-new `public.remarks` table.
--   - It does NOT touch the existing `tasks.remarks` or
--     `documents.remarks` TEXT columns, so nothing that reads those
--     columns today breaks. The frontend simply stops writing new
--     values into them and writes to `public.remarks` instead.
--
-- Run this in Supabase SQL Editor → New query.
-- ============================================================

-- ─── TABLE: remarks ───────────────────────────────────────────
-- One row per remark. `entity_type` + `entity_id` is a lightweight
-- polymorphic reference so the same table serves both Tasks and
-- Documents (and can be extended to other modules later) without
-- needing a separate remarks table per feature.
CREATE TABLE IF NOT EXISTS public.remarks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('task', 'document')),
  entity_id    UUID NOT NULL,
  content      TEXT NOT NULL,
  author_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ──────────────────────────────────────────────────
-- Every read is "give me all remarks for entity X, in order", so a
-- single composite index covers both the filter and the sort.
CREATE INDEX IF NOT EXISTS idx_remarks_entity
  ON public.remarks (entity_type, entity_id, created_at);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read the remarks thread (matches the existing
-- "Anyone authenticated reads tasks/documents" pattern).
CREATE POLICY "Anyone authenticated reads remarks"
  ON public.remarks FOR SELECT TO authenticated USING (true);

-- Anyone signed in can add a remark, but only attributed to
-- themselves — this is what keeps the "User name" on each remark
-- trustworthy (you can't post a remark as someone else).
CREATE POLICY "Authenticated users insert own remarks"
  ON public.remarks FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- No UPDATE or DELETE policy is created on purpose: remarks are
-- append-only / immutable, which is what "do not overwrite previous
-- remarks" means at the database level. (Admins can still remove a
-- row directly via the Supabase dashboard/service role if a remark
-- truly needs to be retracted — that bypasses RLS.)

-- ─── OPTIONAL VIEW: latest remark per entity ───────────────────
-- Handy if you ever want a single "most recent remark" preview
-- (e.g. for a table column) without pulling the whole thread.
CREATE OR REPLACE VIEW public.latest_remarks AS
SELECT DISTINCT ON (entity_type, entity_id)
  entity_type, entity_id, id AS remark_id, content, author_name, author_id, created_at
FROM public.remarks
ORDER BY entity_type, entity_id, created_at DESC;
