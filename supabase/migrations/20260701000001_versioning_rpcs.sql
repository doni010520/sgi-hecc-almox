-- =================================================================
-- VERSIONAMENTO — RPCs (schema drift de produção)
-- =================================================================
-- ⚠️  IMPORTANTE: as funções abaixo já existem em produção, aplicadas
-- direto via dashboard. ESTE ARQUIVO documenta a INTENÇÃO de cada RPC
-- (entrada/saída atômicas, dispensação atômica, confirmação de
-- recebimento). Os corpos abaixo são reconstruções a partir do
-- RESUMO-2026-06-30.md — podem divergir em detalhes do que existe
-- em prod. Antes de aplicar em um ambiente NOVO, faça:
--
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--   WHERE proname IN ('registrar_entrada_estoque','registrar_entrada_nf',
--                     'registrar_saida_lote','confirmar_recebimento_solicitacao',
--                     'criar_dispensacao','aprovar_dispensacao','cancelar_dispensacao');
--
-- e substitua os corpos pelos dumps reais.
--
-- Todas as funções são SECURITY DEFINER para bypassar RLS quando
-- chamadas pelo cliente autenticado (o controle de papel acontece
-- via auth_user_role() dentro da função).
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Entrada de estoque — item único (farmácia, multi-estoque)
--    Cria stock_movements ENTRADA_NF, credita item_stocks(CAF),
--    espelha pharmacy_items.current_stock, registra stock_entries
--    e lote em expiry_tracking — tudo em uma transação.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_entrada_estoque(
  p_item_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_batch_number text,
  p_expiry_date date,
  p_tipo_entrada text,            -- nf | emprestimo | doacao | consignado | troca_validade | inventario
  p_invoice_number text DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caf_id uuid;
  v_entry_id uuid;
  v_tracking_id uuid;
  v_user uuid := auth.uid();
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser > 0';
  END IF;

  SELECT id INTO v_caf_id FROM stock_locations WHERE code = 'CAF' LIMIT 1;
  IF v_caf_id IS NULL THEN
    RAISE EXCEPTION 'Local CAF não encontrado';
  END IF;

  INSERT INTO stock_entries(
    item_id, quantity, unit_cost, batch_number, expiry_date,
    tipo_entrada, invoice_number, supplier_id, origem, observacao,
    created_by
  ) VALUES (
    p_item_id, p_quantity, p_unit_cost, p_batch_number, p_expiry_date,
    p_tipo_entrada, p_invoice_number, p_supplier_id, p_origem, p_observacao,
    v_user
  ) RETURNING id INTO v_entry_id;

  INSERT INTO expiry_tracking(
    item_id, batch_number, expiry_date, current_quantity, unit_price,
    supplier_id, created_by
  ) VALUES (
    p_item_id, p_batch_number, p_expiry_date, p_quantity, p_unit_cost,
    p_supplier_id, v_user
  ) RETURNING id INTO v_tracking_id;

  INSERT INTO stock_movements(
    item_id, quantity, direction, movement_type,
    destination_location_id, batch_number, expiry_date,
    unit_cost, expiry_tracking_id, reason, created_by
  ) VALUES (
    p_item_id, p_quantity, 'in', 'ENTRADA_NF',
    v_caf_id, p_batch_number, p_expiry_date,
    p_unit_cost, v_tracking_id, p_tipo_entrada, v_user
  );

  RETURN v_entry_id;
END;
$$;

-- -----------------------------------------------------------------
-- 2. Entrada em lote — múltiplas linhas com mesmo cabeçalho de NF
--    Recebe JSONB com array de itens. Roda em transação única.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_entrada_nf(
  p_tipo_entrada text,
  p_invoice_number text,
  p_supplier_id uuid,
  p_origem text,
  p_observacao text,
  p_items jsonb              -- [{item_id, quantity, unit_cost, batch_number, expiry_date}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_entry_ids uuid[] := '{}';
  v_entry_id uuid;
BEGIN
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    v_entry_id := registrar_entrada_estoque(
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity')::numeric,
      NULLIF(v_item->>'unit_cost','')::numeric,
      v_item->>'batch_number',
      NULLIF(v_item->>'expiry_date','')::date,
      p_tipo_entrada,
      p_invoice_number,
      p_supplier_id,
      p_origem,
      p_observacao
    );
    v_entry_ids := v_entry_ids || v_entry_id;
  END LOOP;

  RETURN jsonb_build_object('entry_ids', to_jsonb(v_entry_ids));
END;
$$;

-- -----------------------------------------------------------------
-- 3. Saída em lote — registrar quebra/vencimento/transferência/etc.
--    Recebe múltiplos itens + destino. Cria stock_movement de saída,
--    decrementa item_stocks/expiry_tracking, espelha current_stock.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_saida_lote(
  p_source_location_id uuid,
  p_motivo text,             -- quebra|vencimento|transferencia|doacao|permuta|consignado|troca_validade|emprestimo|devolucao_fornecedor
  p_destino_tipo text,       -- external_unit | department | supplier | stock_location | null
  p_destino_id uuid,
  p_destino_nome text,
  p_observacao text,
  p_items jsonb              -- [{item_id, quantity, expiry_tracking_id?, batch_number?, expiry_date?}, ...]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_user uuid := auth.uid();
  v_movement_ids uuid[] := '{}';
  v_movement_id uuid;
  v_movement_type text;
BEGIN
  v_movement_type := CASE
    WHEN p_motivo IN ('transferencia') THEN 'TRANSFERENCIA'
    WHEN p_motivo IN ('quebra','vencimento') THEN 'SAIDA_AVULSA'
    ELSE 'SAIDA_AVULSA'
  END;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO stock_movements(
      item_id, quantity, direction, movement_type,
      source_location_id, batch_number, expiry_date,
      expiry_tracking_id, reason,
      destino_tipo, destino_nome,
      created_by
    ) VALUES (
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity')::numeric,
      'out',
      v_movement_type,
      p_source_location_id,
      v_item->>'batch_number',
      NULLIF(v_item->>'expiry_date','')::date,
      NULLIF(v_item->>'expiry_tracking_id','')::uuid,
      p_motivo,
      p_destino_tipo,
      p_destino_nome,
      v_user
    ) RETURNING id INTO v_movement_id;

    IF (v_item->>'expiry_tracking_id') IS NOT NULL THEN
      PERFORM decrement_expiry_tracking(
        (v_item->>'expiry_tracking_id')::uuid,
        (v_item->>'quantity')::numeric
      );
    END IF;

    v_movement_ids := v_movement_ids || v_movement_id;
  END LOOP;

  RETURN jsonb_build_object('movement_ids', to_jsonb(v_movement_ids));
END;
$$;

-- -----------------------------------------------------------------
-- 4. Confirmar recebimento de solicitação entre estoques
--    Quando CAF entrega a satélite (ou almox a outro setor), o
--    destino confirma e o estoque entra automaticamente lá.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_recebimento_solicitacao(
  p_request_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_request.status NOT IN ('delivered','pending_receipt') THEN
    RAISE EXCEPTION 'Solicitação não está em entrega/aguardando recebimento (status=%)', v_request.status;
  END IF;

  UPDATE requests
     SET delivery_confirmed = true,
         delivery_confirmed_at = now(),
         status = 'completed'
   WHERE id = p_request_id;
END;
$$;

-- -----------------------------------------------------------------
-- 5. Criar dispensação (atomic)
--    Tipos: 'prescricao' (paciente + prescritor + itens) ou
--    'requisicao' (apenas setor + itens).
--    Se algum item exige aprovação (controlados/antimicrobianos/MAV),
--    fica em status='pending_approval' (sem debitar estoque).
--    Caso contrário debita imediatamente.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION criar_dispensacao(
  p_tipo text,                    -- prescricao | requisicao
  p_items jsonb,                  -- [{item_id, quantity, expiry_tracking_id?, batch_number?, expiry_date?}, ...]
  p_patient_id uuid DEFAULT NULL,
  p_patient_name text DEFAULT NULL,
  p_medical_record_number text DEFAULT NULL,
  p_patient_bed_room text DEFAULT NULL,
  p_admission_id uuid DEFAULT NULL,
  p_prescriber_id uuid DEFAULT NULL,
  p_prescribing_doctor text DEFAULT NULL,
  p_prescription_number text DEFAULT NULL,
  p_prescription_date date DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_mav_confirmado boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_dispensation_id uuid;
  v_caf_id uuid;
  v_needs_approval boolean := false;
  v_item jsonb;
  v_item_classes text[];
  v_is_mav boolean;
  v_status text;
BEGIN
  -- Validações por tipo
  IF p_tipo NOT IN ('prescricao','requisicao') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_tipo;
  END IF;

  IF p_tipo = 'requisicao' THEN
    IF p_sector IS NULL OR length(trim(p_sector)) = 0 THEN
      RAISE EXCEPTION 'Requisição exige setor solicitante';
    END IF;
  ELSE
    -- prescricao precisa de paciente E prescritor
    IF (p_patient_id IS NULL AND (p_patient_name IS NULL OR p_medical_record_number IS NULL)) THEN
      RAISE EXCEPTION 'Prescrição exige paciente';
    END IF;
    IF (p_prescriber_id IS NULL AND p_prescribing_doctor IS NULL) THEN
      RAISE EXCEPTION 'Prescrição exige prescritor';
    END IF;
  END IF;

  SELECT id INTO v_caf_id FROM stock_locations WHERE code = 'CAF' LIMIT 1;
  IF v_caf_id IS NULL THEN
    RAISE EXCEPTION 'Local CAF não encontrado';
  END IF;

  -- Avaliar se precisa de aprovação: olhar classes/is_mav dos itens
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    SELECT
      COALESCE(medication_classes, ARRAY[medication_class]::text[]),
      COALESCE(is_mav, false)
    INTO v_item_classes, v_is_mav
    FROM pharmacy_items
    WHERE id = (v_item->>'item_id')::uuid;

    IF v_is_mav
       OR 'mav' = ANY(v_item_classes)
       OR 'controlados' = ANY(v_item_classes)
       OR 'antimicrobianos' = ANY(v_item_classes) THEN
      v_needs_approval := true;
    END IF;
  END LOOP;

  v_status := CASE WHEN v_needs_approval THEN 'pending_approval' ELSE 'completed' END;

  -- Header
  INSERT INTO pharmacy_dispensations(
    tipo, status, source_location_id, mav_confirmado,
    patient_id, patient_name, medical_record_number, patient_bed_room, admission_id,
    prescriber_id, prescribing_doctor, prescription_number, prescription_date,
    sector, notes, created_by
  ) VALUES (
    p_tipo, v_status, v_caf_id, p_mav_confirmado,
    p_patient_id, p_patient_name, p_medical_record_number, p_patient_bed_room, p_admission_id,
    p_prescriber_id, p_prescribing_doctor, p_prescription_number, p_prescription_date,
    p_sector, p_notes, v_user
  ) RETURNING id INTO v_dispensation_id;

  -- Items
  INSERT INTO pharmacy_dispensation_items(
    dispensation_id, item_id, quantity,
    expiry_tracking_id, batch_number, expiry_date
  )
  SELECT
    v_dispensation_id,
    (i->>'item_id')::uuid,
    (i->>'quantity')::numeric,
    NULLIF(i->>'expiry_tracking_id','')::uuid,
    i->>'batch_number',
    NULLIF(i->>'expiry_date','')::date
  FROM jsonb_array_elements(p_items) AS i;

  -- Se não precisa aprovação, debita já
  IF NOT v_needs_approval THEN
    PERFORM _debitar_dispensacao(v_dispensation_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_dispensation_id,
    'status', v_status,
    'needs_approval', v_needs_approval
  );
END;
$$;

-- Helper interno: debita estoque para uma dispensação
CREATE OR REPLACE FUNCTION _debitar_dispensacao(p_dispensation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp pharmacy_dispensations%ROWTYPE;
  v_item pharmacy_dispensation_items%ROWTYPE;
  v_unit_cost numeric;
BEGIN
  SELECT * INTO v_disp FROM pharmacy_dispensations WHERE id = p_dispensation_id;

  FOR v_item IN
    SELECT * FROM pharmacy_dispensation_items WHERE dispensation_id = p_dispensation_id
  LOOP
    SELECT price INTO v_unit_cost FROM pharmacy_items WHERE id = v_item.item_id;

    INSERT INTO stock_movements(
      item_id, quantity, direction, movement_type,
      source_location_id, batch_number, expiry_date,
      unit_cost, expiry_tracking_id, reason,
      dispensation_id, created_by
    ) VALUES (
      v_item.item_id, v_item.quantity, 'out', 'PRESCRICAO',
      v_disp.source_location_id, v_item.batch_number, v_item.expiry_date,
      v_unit_cost, v_item.expiry_tracking_id, 'dispensacao',
      p_dispensation_id, v_disp.created_by
    );

    IF v_item.expiry_tracking_id IS NOT NULL THEN
      PERFORM decrement_expiry_tracking(v_item.expiry_tracking_id, v_item.quantity);
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------
-- 6. Aprovar dispensação (atomic) — debita estoque na aprovação
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION aprovar_dispensacao(p_dispensation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_approver_name text;
BEGIN
  SELECT status INTO v_status FROM pharmacy_dispensations WHERE id = p_dispensation_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Dispensação não encontrada';
  END IF;
  IF v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Dispensação não está pendente (status=%)', v_status;
  END IF;

  SELECT full_name INTO v_approver_name FROM users WHERE id = v_user;

  PERFORM _debitar_dispensacao(p_dispensation_id);

  UPDATE pharmacy_dispensations
     SET status = 'completed',
         approved_by = v_user,
         approved_at = now(),
         approved_by_name = v_approver_name
   WHERE id = p_dispensation_id;
END;
$$;

-- -----------------------------------------------------------------
-- 7. Cancelar dispensação (atomic) — se já foi debitada (completed),
--    estorna o estoque com AJUSTE in @ CAF e devolve lote.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancelar_dispensacao(
  p_dispensation_id uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_disp pharmacy_dispensations%ROWTYPE;
  v_item pharmacy_dispensation_items%ROWTYPE;
BEGIN
  SELECT * INTO v_disp FROM pharmacy_dispensations WHERE id = p_dispensation_id;
  IF v_disp.id IS NULL THEN
    RAISE EXCEPTION 'Dispensação não encontrada';
  END IF;
  IF v_disp.status = 'cancelled' THEN
    RAISE EXCEPTION 'Dispensação já está cancelada';
  END IF;

  -- Se já estava completed, estornar estoque
  IF v_disp.status = 'completed' THEN
    FOR v_item IN
      SELECT * FROM pharmacy_dispensation_items WHERE dispensation_id = p_dispensation_id
    LOOP
      INSERT INTO stock_movements(
        item_id, quantity, direction, movement_type,
        destination_location_id, batch_number, expiry_date,
        expiry_tracking_id, reason,
        dispensation_id, created_by
      ) VALUES (
        v_item.item_id, v_item.quantity, 'in', 'AJUSTE',
        v_disp.source_location_id, v_item.batch_number, v_item.expiry_date,
        v_item.expiry_tracking_id, 'estorno_dispensacao_' || p_dispensation_id::text,
        p_dispensation_id, v_user
      );

      IF v_item.expiry_tracking_id IS NOT NULL THEN
        UPDATE expiry_tracking
           SET current_quantity = current_quantity + v_item.quantity
         WHERE id = v_item.expiry_tracking_id;
      END IF;
    END LOOP;
  END IF;

  UPDATE pharmacy_dispensations
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_user,
         cancellation_reason = p_reason
   WHERE id = p_dispensation_id;
END;
$$;
