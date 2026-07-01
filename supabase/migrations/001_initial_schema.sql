-- ============================================================
-- CBMS Operations Dashboard — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ─── Enable UUID extension ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES (extends auth.users) ───────────────────────────
-- CHANGED: "email" column replaced with "username".
-- auth.users.email still exists internally (Supabase Auth requires it),
-- but the app-facing identity field is now username.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CHANGED: new index for fast username lookups (used during the
-- username → synthetic-email translation step at login time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ─── CALENDAR EVENTS ─────────────────────────────────────────
-- No changes — does not reference email/username
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  time        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Meeting' CHECK (type IN ('Deadline', 'Meeting', 'Review', 'Briefing')),
  description TEXT DEFAULT '',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REQUIREMENTS (Checklist) ─────────────────────────────────
-- No changes
CREATE TABLE IF NOT EXISTS public.requirements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requirement  TEXT NOT NULL,
  office       TEXT NOT NULL,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Completed', 'Ongoing', 'Pending', 'For Review', 'Returned')),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOCUMENTS ────────────────────────────────────────────────
-- No changes
CREATE TABLE IF NOT EXISTS public.documents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number     TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'Letter' CHECK (category IN ('Agreement','Compliance','Memorandum','Letter','Report','Order','Form','Other')),
  subject             TEXT DEFAULT '',
  date_received       DATE NOT NULL,
  date_released       DATE,
  originating_office  TEXT NOT NULL DEFAULT '',
  destination_office  TEXT NOT NULL DEFAULT '',
  current_office      TEXT NOT NULL DEFAULT '',
  assigned_personnel  TEXT DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'Received' CHECK (status IN ('Received','In Process','Forwarded','Released','Completed','Returned')),
  remarks             TEXT DEFAULT '',
  attachment_url      TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOCUMENT HISTORY ────────────────────────────────────────
-- No changes
CREATE TABLE IF NOT EXISTS public.document_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  office      TEXT NOT NULL,
  action      TEXT NOT NULL,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ─── ANNOUNCEMENTS ───────────────────────────────────────────
-- No changes
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'Info' CHECK (type IN ('Info','Warning','Urgent','Update')),
  author      TEXT NOT NULL DEFAULT '',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_requirements_status  ON public.requirements(status);
CREATE INDEX IF NOT EXISTS idx_documents_status     ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_tracking   ON public.documents(tracking_number);
CREATE INDEX IF NOT EXISTS idx_doc_history_doc_id   ON public.document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON public.announcements(created_at DESC);

-- ─── UPDATED_AT trigger function ─────────────────────────────
-- No changes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_requirements_updated_at    BEFORE UPDATE ON public.requirements    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_documents_updated_at       BEFORE UPDATE ON public.documents       FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_announcements_updated_at   BEFORE UPDATE ON public.announcements   FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Auto-create profile on signup ───────────────────────────
-- CHANGED: previously pulled NEW.email and derived a fallback name
-- from the email's local part. Now reads "username" directly from
-- the signup metadata (your frontend must pass it — see note below).
-- This function still fires on auth.users INSERT (untouchable trigger
-- target), but no longer reads or stores NEW.email anywhere.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────
-- No changes to any RLS policy below — none reference email/username

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view all profiles"   ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Anyone authenticated reads events"  ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert events"               ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update events"               ON public.calendar_events FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete events"               ON public.calendar_events FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Anyone authenticated reads requirements"  ON public.requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert requirements"               ON public.requirements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update requirements"               ON public.requirements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete requirements"               ON public.requirements FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Anyone authenticated reads documents"  ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert documents"               ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update documents"               ON public.documents FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete documents"               ON public.documents FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Anyone authenticated reads history"  ON public.document_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert history"               ON public.document_history FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Anyone authenticated reads announcements"  ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert announcements"               ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update announcements"               ON public.announcements FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete announcements"               ON public.announcements FOR DELETE TO authenticated USING (public.is_admin());