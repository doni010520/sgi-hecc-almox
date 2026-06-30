-- =================================================================
-- F5 — Auditoria de saída do almoxarifado
-- =================================================================
-- Hoje warehouse_dispatches e warehouse_dispatch_items só recebem
-- INSERT do service (e um trigger no banco decrementa current_stock),
-- mas não tem trilha em audit_logs. Resultado: nenhuma saída de
-- almoxarifado aparece no v_global_audit_log.
--
-- Esta migration adiciona audit_log_changes nessas tabelas e em
-- warehouse_items (caso ainda não tenha). Idempotente.
-- =================================================================

-- warehouse_dispatches (cabeçalho)
DROP TRIGGER IF EXISTS audit_warehouse_dispatches ON warehouse_dispatches;
CREATE TRIGGER audit_warehouse_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON warehouse_dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- warehouse_dispatch_items (linhas)
DROP TRIGGER IF EXISTS audit_warehouse_dispatch_items ON warehouse_dispatch_items;
CREATE TRIGGER audit_warehouse_dispatch_items
  AFTER INSERT OR UPDATE OR DELETE ON warehouse_dispatch_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- warehouse_items — garante (já deve existir, mas DROP+CREATE é idempotente).
DROP TRIGGER IF EXISTS audit_warehouse_items_changes ON warehouse_items;
CREATE TRIGGER audit_warehouse_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON warehouse_items
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- ----------------------------------------------------------------
-- Expande a view v_global_audit_log: por padrão, audit_logs já
-- captura tudo de warehouse_dispatches/dispatch_items via a nova
-- trigger. Não precisa alterar a view — ela já lê de audit_logs
-- via union all.
-- ----------------------------------------------------------------

COMMENT ON TRIGGER audit_warehouse_dispatches ON warehouse_dispatches IS
  'F5: trilha em audit_logs (aparecem no v_global_audit_log)';
