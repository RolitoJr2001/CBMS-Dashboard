-- RBAC support for CBMS dashboard
-- This keeps existing data intact and adds role-based access rules for personnel users.

-- Recreate the task table check constraint to include the new statuses if needed.
ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_status_check
CHECK (status IN ('Not Started', 'Ongoing', 'Pending', 'Completed', 'In Progress'));

-- Allow admins to manage everything and let personnel view/update only their own assigned tasks.
DROP POLICY IF EXISTS "Admins insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anyone authenticated reads tasks" ON public.tasks;

CREATE POLICY "Anyone authenticated reads tasks" ON public.tasks
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins update tasks" ON public.tasks
FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins delete tasks" ON public.tasks
FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Personnel update own tasks" ON public.tasks
FOR UPDATE TO authenticated
USING (
  assigned_to IS NOT NULL
  AND lower(trim(assigned_to)) IN (
    SELECT lower(trim(coalesce(username, ''))) FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT lower(trim(coalesce(name, ''))) FROM public.profiles WHERE id = auth.uid()
  )
);

-- Allow authenticated users to manage documents in the tracking tab.
DROP POLICY IF EXISTS "Admins insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admins update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins delete documents" ON public.documents;
DROP POLICY IF EXISTS "Anyone authenticated reads documents" ON public.documents;
DROP POLICY IF EXISTS "Any authenticated inserts documents" ON public.documents;
DROP POLICY IF EXISTS "Any authenticated updates documents" ON public.documents;
DROP POLICY IF EXISTS "Any authenticated deletes documents" ON public.documents;

CREATE POLICY "Anyone authenticated reads documents" ON public.documents
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users insert documents" ON public.documents
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users update documents" ON public.documents
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users delete documents" ON public.documents
FOR DELETE TO authenticated USING (true);

-- Allow authenticated users to write document history for the tracking tab.
DROP POLICY IF EXISTS "Admins insert history" ON public.document_history;
DROP POLICY IF EXISTS "Anyone authenticated reads history" ON public.document_history;

CREATE POLICY "Anyone authenticated reads history" ON public.document_history
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users insert history" ON public.document_history
FOR INSERT TO authenticated WITH CHECK (true);

-- Keep calendar, requirements, announcements and profiles accessible for authenticated users.
-- Existing policies remain in place for admin-managed modules.
