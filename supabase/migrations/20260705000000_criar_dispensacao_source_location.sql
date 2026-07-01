-- =================================================================
-- G1 — Multi-estoque: dispensação sai do estoque ativo (não CAF fixo)
-- =================================================================
-- Hoje a RPC criar_dispensacao debita SEMPRE do CAF, mesmo quando o
-- usuário está trabalhando em um satélite (SAT_1, SAT_2, SAT_T).
--
-- Esta migration prepara o parâmetro p_source_location_code (opcional,
-- default 'CAF') na função. O frontend deve passar activeStock.code
-- quando disponível. Se o param não vier, mantém CAF pra back-compat.
--
-- ⚠️ CUIDADO: minha versão do corpo da função é uma reconstrução
-- baseada no comportamento observado. Antes de aplicar em prod:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--   WHERE proname = 'criar_dispensacao';
-- e valide se a lógica bate. Se for diferente, adapte só a linha
-- do source_location.
-- =================================================================

-- Recomendação: ao invés de recriar a função (que pode ter lógica
-- adicional não documentada aqui), aplique apenas ALTER FUNCTION:
--
-- ALTER FUNCTION criar_dispensacao(...) OWNER TO postgres;  -- se precisar
--
-- OU faça só a mudança do source: no corpo da função existente,
-- substitua:
--   v_source_location_id := (SELECT id FROM stock_locations WHERE code='CAF');
-- por:
--   v_source_location_id := (SELECT id FROM stock_locations
--                            WHERE code = COALESCE(p_source_location_code,'CAF'));
--
-- E adicione p_source_location_code text DEFAULT NULL nos parâmetros.
--
-- Esta migration serve como MARCADOR de que essa mudança é necessária.
-- Não recria a função pra evitar sobrescrever lógica em prod.

COMMENT ON FUNCTION criar_dispensacao IS
  'G1 (2026-07-01): TODO — aceitar p_source_location_code opcional (default CAF) pra suportar dispensação de satélites. Frontend em new.tsx já lê saldo do activeStock; falta a saída também sair de lá.';
