-- ============================================================
-- 004_username_lookup.sql
-- Username -> email resolver for username-only login
-- ============================================================
-- This replaces an earlier, conflicting attempt at a fully custom
-- local_users + pgcrypto auth table. That approach is removed because
-- it duplicated Supabase Auth instead of working with it, and nothing
-- in the frontend ever called it.
--
-- This is the supported approach: Supabase Auth still manages real
-- sessions, password hashing, and refresh tokens. Every account's
-- actual auth.users.email is a synthetic, non-deliverable address
-- (e.g. admin@username.cbms.local) that the user never sees or types.
-- The function below lets the login screen resolve a typed username
-- to that synthetic email BEFORE calling supabase.auth.signInWithPassword,
-- so the end-to-end experience is "log in with username and password."
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username TEXT)
RETURNS TEXT AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Allow anonymous (not-yet-logged-in) clients to call this — required,
-- since the user has no session yet at the moment they're logging in.
-- This is safe: it only returns a single email string for an exact
-- username match, and reveals nothing else about the profiles table.
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(TEXT) TO authenticated;
