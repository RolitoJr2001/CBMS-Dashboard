CREATE TABLE IF NOT EXISTS public.personnel (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads personnel" ON public.personnel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert personnel" ON public.personnel FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update personnel" ON public.personnel FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete personnel" ON public.personnel FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_personnel_updated_at
  BEFORE UPDATE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
