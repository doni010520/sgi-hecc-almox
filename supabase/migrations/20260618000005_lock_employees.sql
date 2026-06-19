-- ================================================================
-- Tranca RLS da tabela employees (estava aberta a 'public' = anon)
-- employees_write era ALL TO public => anon podia escrever. Crítico.
-- Tabela vazia hoje; lookup por matrícula cai no fallback de users.
-- ================================================================

DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_write"  ON public.employees;

CREATE POLICY "employees_select_auth" ON public.employees
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "employees_insert_mgr" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));

CREATE POLICY "employees_update_mgr" ON public.employees
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador','gestor'))
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));

CREATE POLICY "employees_delete_admin" ON public.employees
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- Remove a função temporária de introspecção
DROP FUNCTION IF EXISTS public._sec_introspect();
