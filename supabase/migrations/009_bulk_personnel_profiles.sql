-- Bulk profile setup for multiple CBMS personnel users.
-- IMPORTANT: Create the auth users first in Supabase Dashboard -> Authentication -> Users.
-- Use the same username as the email local-part, for example:
--   cbms.ericka@cbms.local
--   cbms.ed@cbms.local
--   cbms.arvie@cbms.local
--   cbms.junjungwaps@cbms.local
--   cbms.chiri@cbms.local
--   cbms.head@cbms.local
--
-- Then run this SQL to create or update the matching public.profiles rows.

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.ericka', 'Ericka', 'viewer'
FROM auth.users au
WHERE au.email = 'cbms.ericka@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.ed', 'Ed', 'viewer'
FROM auth.users au
WHERE au.email = 'cbms.ed@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.arvie', 'Arvie', 'viewer'
FROM auth.users au
WHERE au.email = 'cbms.arvie@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.junjungwaps', 'Junjungwaps', 'viewer'
FROM auth.users au
WHERE au.email = 'cbms.junjungwaps@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.chiri', 'Chiri', 'viewer'
FROM auth.users au
WHERE au.email = 'cbms.chiri@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;

INSERT INTO public.profiles (id, username, name, role)
SELECT au.id, 'cbms.head', 'Head', 'admin'
FROM auth.users au
WHERE au.email = 'cbms.head@cbms.local'
ON CONFLICT (username) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role;
