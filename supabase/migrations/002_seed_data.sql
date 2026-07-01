-- ============================================================
-- CBMS Seed Data — Run AFTER 001_initial_schema.sql and 004_username_lookup.sql
-- NOTE: Admin user must already exist via Supabase Auth (see Step 2 below)
-- ============================================================

-- ─── Seed Calendar Events ────────────────────────────────────
INSERT INTO public.calendar_events (title, date, time, type, description) VALUES
  ('Municipal Submission Deadline — Batch 1', '2026-06-28', '5:00 PM', 'Deadline', 'First batch municipal data submission deadline'),
  ('CBMS Coordination Meeting',               '2026-07-05', '9:00 AM', 'Meeting',  'Coordination meeting for all provincial offices'),
  ('Data Turnover Final Submission',           '2026-07-15', '5:00 PM', 'Deadline', 'Final CBMS data turnover submission'),
  ('GIS Mapping Review Session',               '2026-07-20', '1:30 PM', 'Review',   'Review of geo-tagged and mapped CBMS data'),
  ('Quarterly Statistics Briefing',            '2026-07-30', '10:00 AM','Briefing', 'Quarterly briefing for statistics stakeholders')
ON CONFLICT DO NOTHING;

-- ─── Seed Requirements ───────────────────────────────────────
INSERT INTO public.requirements (requirement, office, due_date, status) VALUES
  ('Designation Order of Data Protection Officer',       'Provincial Statistics Office', '2026-01-15', 'Completed'),
  ('Designation Order of Provincial Statistician',       'Office of the Governor',       '2026-01-20', 'Completed'),
  ('Privacy Impact Assessment',                          'Data Protection Office',        '2026-07-10', 'Ongoing'),
  ('NPC Registration',                                   'Data Protection Office',        '2026-07-31', 'Pending'),
  ('CBMS Database Backup and Encryption Certificate',    'ICT Division',                  '2026-02-05', 'Completed'),
  ('Municipal Turnover Acceptance Forms (1st Batch)',    'Municipal Planning Offices',     '2026-06-28', 'Ongoing'),
  ('Data Sharing Agreement with PSA',                    'Provincial Statistics Office',  '2026-08-15', 'Pending'),
  ('CBMS Enumerator Training Completion Report',         'CBMS Field Operations',         '2026-01-30', 'Completed'),
  ('Data Validation and Cleaning Report',                'ICT Division',                  '2026-07-05', 'Ongoing'),
  ('Geo-tagging and GIS Mapping Submission',             'GIS Unit',                      '2026-08-01', 'Pending')
ON CONFLICT DO NOTHING;

-- ─── Seed Documents ──────────────────────────────────────────
INSERT INTO public.documents
  (tracking_number, title, category, subject, date_received, date_released,
   originating_office, destination_office, current_office,
   assigned_personnel, status, remarks)
VALUES
  ('TRK-2026-001', 'CBMS Data Sharing Agreement', 'Agreement',
   'Data sharing between PSA and Provincial Office', '2026-06-10', NULL,
   'PSA Regional Office', 'Provincial Statistics Office', 'Provincial Statistics Office',
   'Maria Santos', 'In Process', 'Awaiting legal review'),
  ('TRK-2026-002', 'Privacy Impact Assessment Form', 'Compliance',
   'PIA submission for CBMS database', '2026-06-15', '2026-06-18',
   'Data Protection Office', 'ICT Division', 'ICT Division',
   'Juan dela Cruz', 'Forwarded', 'Forwarded to ICT for technical review')
ON CONFLICT (tracking_number) DO NOTHING;

-- ─── Seed Announcements ──────────────────────────────────────
INSERT INTO public.announcements (title, body, type, author) VALUES
  ('CBMS Data Turnover Deadline Extended',
   'The deadline for the submission of CBMS data turnover documents has been extended to July 31, 2026. All concerned offices are advised to prepare their requirements accordingly.',
   'Update', 'DASMO Admin'),
  ('NPC Registration Reminder',
   'All local government units are reminded to complete their NPC (National Privacy Commission) registration before July 31. Failure to comply may result in penalties.',
   'Urgent', 'Data Protection Office'),
  ('New Document Tracking System',
   'The CBMS Operations Dashboard now includes a document tracking module. All inter-office correspondence related to CBMS should be logged in the system.',
   'Info', 'ICT Division')
ON CONFLICT DO NOTHING;

-- ─── Seed Document History ───────────────────────────────────
INSERT INTO public.document_history (document_id, office, action, timestamp)
SELECT d.id, 'PSA Regional Office', 'Sent', '2026-06-10 08:00:00+08'
FROM public.documents d WHERE d.tracking_number = 'TRK-2026-001';

INSERT INTO public.document_history (document_id, office, action, timestamp)
SELECT d.id, 'Provincial Statistics Office', 'Received', '2026-06-10 14:30:00+08'
FROM public.documents d WHERE d.tracking_number = 'TRK-2026-001';

INSERT INTO public.document_history (document_id, office, action, timestamp)
SELECT d.id, 'Data Protection Office', 'Sent', '2026-06-15 09:00:00+08'
FROM public.documents d WHERE d.tracking_number = 'TRK-2026-002';

INSERT INTO public.document_history (document_id, office, action, timestamp)
SELECT d.id, 'Provincial Statistics Office', 'Received', '2026-06-15 11:00:00+08'
FROM public.documents d WHERE d.tracking_number = 'TRK-2026-002';

INSERT INTO public.document_history (document_id, office, action, timestamp)
SELECT d.id, 'ICT Division', 'Forwarded', '2026-06-18 10:00:00+08'
FROM public.documents d WHERE d.tracking_number = 'TRK-2026-002';

-- ────────────────────────────────────────────────────────────
-- Seed Admin Profile (username-based)
-- ────────────────────────────────────────────────────────────
-- This block does NOT create the auth.users row — Supabase Auth users
-- cannot be created via plain SQL (no access to set a hashed password
-- through the public schema). You must create the admin user first via:
--
--   Option A — Dashboard: Authentication → Users → Add user
--     Email:    admin@username.cbms.local   (synthetic, per Path A)
--     Password: (set a real password)
--     User Metadata (raw_user_meta_data), as JSON:
--       { "username": "admin", "name": "DASMO Administrator", "role": "admin" }
--
--   Option B — Supabase CLI / Admin API:
--     supabase.auth.admin.createUser({
--       email: "admin@username.cbms.local",
--       password: "<your-password>",
--       email_confirm: true,
--       user_metadata: { username: "admin", name: "DASMO Administrator", role: "admin" }
--     })
--
-- Either option fires the handle_new_user() trigger from 001_initial_schema.sql,
-- which reads raw_user_meta_data and creates the public.profiles row
-- automatically — username, name, and role included. No manual INSERT
-- into public.profiles is needed or safe to do here.
--
-- The block below is a SAFETY NET ONLY: it patches the profile's role to
-- 'admin' in case the user was created without the metadata role field set
-- (e.g. created manually through the Dashboard UI's basic "Add user" form,
-- which does not have a metadata input).

UPDATE public.profiles
SET role = 'admin'
WHERE username = 'admin';