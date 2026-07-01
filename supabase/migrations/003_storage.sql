-- ============================================================
-- CBMS Storage Buckets — Run in SQL Editor
-- Creates a private bucket for document attachments
-- ============================================================

-- Insert the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-attachments',
  'document-attachments',
  false,
  10485760,  -- 10 MB per file
  ARRAY['application/pdf','image/jpeg','image/png','image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS ────────────────────────────────────────────

-- Authenticated users can read attachments
CREATE POLICY "Authenticated users can read attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'document-attachments');

-- Admins can upload attachments
CREATE POLICY "Admins can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'document-attachments'
    AND public.is_admin()
  );

-- Admins can delete attachments
CREATE POLICY "Admins can delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'document-attachments'
    AND public.is_admin()
  );
