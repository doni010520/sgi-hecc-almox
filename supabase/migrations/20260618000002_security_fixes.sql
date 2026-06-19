-- ================================================================
-- Correções de segurança da migration 20260618000001
-- 1. View vazava dados (security definer) — RLS era ignorado
-- 2. Função SECURITY DEFINER sem search_path fixo (injeção)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. auth_user_role(): fixar search_path e qualificar objetos
--    (CREATE OR REPLACE mantém o OID — policies continuam válidas)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = (SELECT auth.uid())
$$;

-- ----------------------------------------------------------------
-- 2. lgpd_data_requests_view: aplicar RLS do usuário que consulta
--    (security_invoker = on, PG 15+) e remover acesso anônimo
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS public.lgpd_data_requests_view;

CREATE VIEW public.lgpd_data_requests_view
WITH (security_invoker = on) AS
SELECT *, (requested_at + INTERVAL '15 days') AS deadline_at
FROM public.lgpd_data_requests;

-- Defesa em profundidade: a view nunca deve ser legível por anon
REVOKE ALL ON public.lgpd_data_requests_view FROM anon;
GRANT SELECT ON public.lgpd_data_requests_view TO authenticated;
