-- ============================================================
-- Migration 016: Task Priority + Task Attachments
-- ============================================================
-- Run this in Supabase SQL Editor → New query. ADDITIVE ONLY —
-- does not touch or remove any existing column, table, row, or
-- policy. Supports the new Task Details modal, which now shows a
-- Priority field and an optional Attachment for every task.
--
-- Covers:
--   1. `priority` column on public.tasks (Low/Medium/High/Urgent,
--      defaults to 'Medium' so existing rows get a sensible value
--      without needing a backfill).
--   2. `attachment_url` column on public.tasks — stores the storage
--      *path* (not a signed URL, since signed URLs expire) for an
--      optional file attached to a task, mirroring how
--      public.documents.attachment_url already works.
--   3. A private `task-attachments` storage bucket + RLS policies,
--      mirroring migration 003_storage.sql's document-attachments
--      bucket exactly (authenticated read, admin-only write/delete).
-- ============================================================


-- ─── 1. Priority ────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_priority_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent'));
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.priority IS
  'Task priority shown on the Task card and in the Task Details modal. Defaults to Medium for all existing tasks.';


-- ─── 2. Attachment ──────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

COMMENT ON COLUMN public.tasks.attachment_url IS
  'Storage path (in the task-attachments bucket) of an optional file attached to this task. NULL when no attachment exists — the modal only shows the Attachments section when this is set.';


-- ─── 3. Storage bucket + policies ───────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can read task attachments'
  ) THEN
    CREATE POLICY "Authenticated users can read task attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'task-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload task attachments'
  ) THEN
    CREATE POLICY "Admins can upload task attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'task-attachments'
        AND public.is_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete task attachments'
  ) THEN
    CREATE POLICY "Admins can delete task attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'task-attachments'
        AND public.is_admin()
      );
  END IF;
END $$;
