-- ================================================================
-- Tranca leitura anônima da tabela users (vazava 186 perfis: nome,
-- matrícula, cargo, setor a qualquer um com a chave pública).
-- O painel de TV público é o único consumidor anon — reposto via
-- funções security definer que entregam SÓ o mínimo necessário.
-- ================================================================

-- 1. Remove a policy permissiva (TO public = inclui anon)
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;

-- 2. Leitura passa a ser apenas de usuários autenticados
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
CREATE POLICY "users_select_authenticated" ON public.users
  FOR SELECT TO authenticated
  USING (true);

-- 3. RPC para a TV: nomes dos solicitantes (apenas id + full_name, por lista de ids)
CREATE OR REPLACE FUNCTION public.get_requester_names(ids uuid[])
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u.full_name
  FROM public.users u
  WHERE u.id = ANY(ids)
$$;
GRANT EXECUTE ON FUNCTION public.get_requester_names(uuid[]) TO anon, authenticated;

-- 4. RPC para a TV: lookup de funcionário por matrícula (mínimo necessário)
--    (employees está vazia; comportamento efetivo hoje já é via users)
CREATE OR REPLACE FUNCTION public.lookup_employee_by_matricula(mat text)
RETURNS TABLE(id uuid, full_name text, matricula text, cargo text, department_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id, u.full_name, u.matricula, u.role::text AS cargo,
         (SELECT d.name FROM public.departments d WHERE d.id = u.department_id) AS department_name
  FROM public.users u
  WHERE u.matricula = mat
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.lookup_employee_by_matricula(text) TO anon, authenticated;
