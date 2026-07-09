-- Enrich document_history so the Routing History timeline can show
-- From Office, To Office, Assigned Personnel, Status, and Remarks for
-- each routing event (previously only office/action/timestamp were
-- recorded, which was not enough detail for the requested timeline UI).
-- All new columns are nullable so existing rows remain valid; the
-- application fills them in going forward and falls back to "—" for
-- older rows that predate this migration.

ALTER TABLE public.document_history
  ADD COLUMN IF NOT EXISTS from_office text,
  ADD COLUMN IF NOT EXISTS to_office text,
  ADD COLUMN IF NOT EXISTS assigned_personnel text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS remarks text;
