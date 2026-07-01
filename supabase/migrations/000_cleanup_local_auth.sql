-- ============================================================
-- 000_cleanup_local_auth.sql  (RUN ONLY IF NEEDED — see note)
-- ============================================================
-- If you already ran the old "004_local_auth.sql" against your live
-- Supabase project (Authentication worked partially, or you saw a
-- "local_users" table in Table Editor), run this FIRST to remove it
-- before applying the new 004_username_lookup.sql.
--
-- If you never ran that file against your actual Supabase project
-- (only had it sitting in your local folder), skip this file entirely.
-- ============================================================

DROP FUNCTION IF EXISTS public.authenticate_local_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_local_user(TEXT, TEXT, UUID);
DROP TABLE IF EXISTS public.local_users;

-- Note: this does NOT drop public.profiles.username or its unique index —
-- those are still required by the correct schema in 001_initial_schema.sql.
