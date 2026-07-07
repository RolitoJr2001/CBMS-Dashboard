CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  assigned_by TEXT NOT NULL DEFAULT '',
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Not Started', 'Ongoing', 'Pending', 'Completed', 'In Progress')),
  remarks     TEXT DEFAULT '',
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
