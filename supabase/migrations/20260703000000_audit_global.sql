-- =================================================================
-- F3 — Histórico/Auditoria global
-- =================================================================
-- 1. Estende a trigger audit_log_changes às tabelas operacionais que
--    ainda não têm: pharmacy_dispensations, patients, external_units.
--    (As demais — pharmacy_items, warehouse_items, requests, users,
--     stock_entries, livros_controlados, medication_losses,
--     notificacao_receita, bmpo_balancos — já têm desde antes.)
--
-- 2. View unificada v_global_audit_log: junta o que vem de audit_logs
--    (mudanças de cadastro) com o que vem de stock_movements
--    (movimentações operacionais). Mesmo schema: quando, quem, ação,
--    entidade, detalhe (jsonb).
-- =================================================================

-- ----------------------------------------------------------------
-- 1. Triggers adicionais
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_pharmacy_dispensations ON pharmacy_dispensations;
CREATE TRIGGER audit_pharmacy_dispensations
  AFTER INSERT OR UPDATE OR DELETE ON pharmacy_dispensations
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

DROP TRIGGER IF EXISTS audit_patients ON patients;
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- external_units pode não existir em todos os ambientes; guardamos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'external_units') THEN
    DROP TRIGGER IF EXISTS audit_external_units ON external_units;
    CREATE TRIGGER audit_external_units
      AFTER INSERT OR UPDATE OR DELETE ON external_units
      FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
  END IF;
END$$;

-- ----------------------------------------------------------------
-- 2. View unificada v_global_audit_log
--    Schema:
--      ts            timestamptz  — momento do evento
--      actor_id      uuid          — auth.uid() na hora
--      actor_name    text          — full_name do users
--      origem        text          — 'audit' | 'stock'
--      action        text          — INSERT/UPDATE/DELETE ou movement_type
--      entity        text          — nome da tabela (audit) ou 'stock_movement'
--      entity_id     uuid          — id do registro afetado
--      details       jsonb         — payload (audit_logs.new_data/old_data ou stock_movements completo)
--
--    security_invoker=on para que RLS do usuário se aplique nas tabelas-fonte
--    (audit_logs já é restrita a admins; stock_movements visível conforme RLS).
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_global_audit_log;
CREATE VIEW v_global_audit_log
WITH (security_invoker = on)
AS
SELECT
  al.created_at                              AS ts,
  al.changed_by                              AS actor_id,
  u.full_name                                AS actor_name,
  'audit'::text                              AS origem,
  al.action                                  AS action,
  al.table_name                              AS entity,
  al.record_id                               AS entity_id,
  jsonb_build_object(
    'old_data', al.old_data,
    'new_data', al.new_data
  )                                          AS details
FROM audit_logs al
LEFT JOIN users u ON u.id = al.changed_by

UNION ALL

SELECT
  sm.performed_at                            AS ts,
  sm.performed_by                            AS actor_id,
  u.full_name                                AS actor_name,
  'stock'::text                              AS origem,
  sm.movement_type                           AS action,
  'stock_movement'::text                     AS entity,
  sm.id                                      AS entity_id,
  jsonb_build_object(
    'item_id', sm.item_id,
    'item_type', sm.item_type,
    'quantity', sm.quantity,
    'direction', sm.direction,
    'movement_type', sm.movement_type,
    'source_location_id', sm.source_location_id,
    'target_location_id', sm.target_location_id,
    'unit_cost', sm.unit_cost,
    'reason', sm.reason,
    'reason_detail', sm.reason_detail,
    'notes', sm.notes,
    'destino_tipo', sm.destino_tipo,
    'destino_nome', sm.destino_nome,
    'request_id', sm.request_id,
    'dispensation_id', sm.dispensation_id,
    'patient_id', sm.patient_id,
    'medical_record_number', sm.medical_record_number
  )                                          AS details
FROM stock_movements sm
LEFT JOIN users u ON u.id = sm.performed_by;

COMMENT ON VIEW v_global_audit_log IS
  'F3: histórico unificado audit_logs ∪ stock_movements. Filtros: ts/actor/entity/action.';
