-- =================================================================
-- VERSIONAMENTO — Triggers e RLS (schema drift de produção)
-- =================================================================
-- Idempotente. DROP IF EXISTS + CREATE.
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Trigger trg_seed_item_stock_caf
--    Todo pharmacy_item novo nasce com linha em item_stocks(CAF=0),
--    evitando "sem saldo registrado" na primeira saída.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_seed_item_stock_caf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caf_id uuid;
BEGIN
  SELECT id INTO v_caf_id FROM stock_locations WHERE code = 'CAF' LIMIT 1;
  IF v_caf_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO item_stocks(item_id, location_id, quantity, min_qty, max_qty)
  VALUES (NEW.id, v_caf_id, 0, NEW.minimum_stock, NULL)
  ON CONFLICT (item_id, location_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_item_stock_caf ON pharmacy_items;
CREATE TRIGGER trg_seed_item_stock_caf
  AFTER INSERT ON pharmacy_items
  FOR EACH ROW EXECUTE FUNCTION fn_seed_item_stock_caf();

-- -----------------------------------------------------------------
-- 2. Ajuste em deduct_stock_on_request_delivered
--    Quando CAF entrega para um satélite, a entrega NÃO debita do
--    CAF imediatamente — espera a confirmação de recebimento do
--    satélite (confirmar_recebimento_solicitacao) e nesse momento
--    cria a TRANSFERENCIA real (sai do CAF, entra no satélite).
--    Para entregas a setor/posto, segue o débito direto.
--
--    NOTA: a função original existe em prod. Este bloco é apenas
--    documentação do comportamento esperado.
-- -----------------------------------------------------------------
-- (sem alteração: a função vive em prod; comentado para referência)

-- -----------------------------------------------------------------
-- 3. RLS para external_units
-- -----------------------------------------------------------------
ALTER TABLE external_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "external_units_select" ON external_units;
CREATE POLICY "external_units_select" ON external_units
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "external_units_insert" ON external_units;
CREATE POLICY "external_units_insert" ON external_units
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador','gestor','atendente'));

DROP POLICY IF EXISTS "external_units_update" ON external_units;
CREATE POLICY "external_units_update" ON external_units
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador','gestor'))
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));

DROP POLICY IF EXISTS "external_units_delete" ON external_units;
CREATE POLICY "external_units_delete" ON external_units
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- -----------------------------------------------------------------
-- 4. RLS de confirmação de recebimento — qualquer usuário autenticado
--    pode confirmar recebimento de uma solicitação entregue a ele.
--    (a função confirmar_recebimento_solicitacao é SECURITY DEFINER,
--    então o controle real fica nela; aqui é só liberar UPDATE
--    pra quem não é gestor/admin/atendente).
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "requests_confirm_receipt" ON requests;
CREATE POLICY "requests_confirm_receipt" ON requests
  FOR UPDATE TO authenticated
  USING (
    status IN ('delivered','pending_receipt')
    AND (requester_id = auth.uid() OR auth_user_role() IN ('administrador','gestor','atendente'))
  )
  WITH CHECK (
    status IN ('delivered','pending_receipt','completed')
    AND (requester_id = auth.uid() OR auth_user_role() IN ('administrador','gestor','atendente'))
  );
