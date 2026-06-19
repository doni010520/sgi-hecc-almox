-- TEMP: introspecção de RLS para diagnóstico de segurança (será removida)
CREATE OR REPLACE FUNCTION public._sec_introspect()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'users_rls_enabled',     (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass),
    'employees_rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.employees'::regclass),
    'policies', (
      SELECT jsonb_agg(jsonb_build_object(
        'table', tablename, 'policy', policyname, 'roles', roles, 'cmd', cmd
      ))
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('users','employees')
    )
  )
$$;
GRANT EXECUTE ON FUNCTION public._sec_introspect() TO service_role;
