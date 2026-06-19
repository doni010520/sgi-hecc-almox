-- ================================================================
-- Módulos de conformidade — Portaria 344/98
-- 1. Perdas / Inutilização   2. Notificação de Receita   3. BMPO
-- Aditivo. RLS por papel (auth_user_role) + auditoria.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Perdas / Inutilização (Art. 67/68 — registro de perdas)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medication_losses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES pharmacy_items(id),
  item_nome text NOT NULL,
  stock_location_id uuid REFERENCES stock_locations(id),
  batch_number text,
  expiry_date date,
  quantity numeric NOT NULL,
  motivo text NOT NULL,          -- vencimento, quebra, avaria, desvio, contaminacao, recolhimento, outro
  documento text,                -- nº do termo/ata de inutilização
  observacao text,
  is_controlado boolean DEFAULT false,
  responsavel_nome text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medication_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "losses_select" ON medication_losses
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "losses_insert" ON medication_losses
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "losses_update" ON medication_losses
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador','gestor'))
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));
CREATE POLICY "losses_delete" ON medication_losses
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

CREATE TRIGGER audit_medication_losses
  AFTER INSERT OR UPDATE OR DELETE ON medication_losses
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- ----------------------------------------------------------------
-- 2. Notificação de Receita (Portaria 344/98 — controle do receituário)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacao_receita (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,            -- A (amarela), B (azul), C_ESPECIAL (branca/2 vias)
  subtipo text,                  -- A1, A2, A3, B1, B2, C1, C2, C3...
  numero text NOT NULL,
  serie_talao text,
  paciente_id uuid REFERENCES patients(id),
  paciente_nome text NOT NULL,
  prescritor_nome text,
  prescritor_registro text,      -- CRM/CRO
  prescritor_uf text,
  data_prescricao date,
  data_dispensacao date,
  dispensation_id uuid REFERENCES pharmacy_dispensations(id),
  item_nome text,
  quantidade text,
  retida boolean DEFAULT true,   -- via retida na farmácia
  observacao text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notificacao_receita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nr_select" ON notificacao_receita
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "nr_insert" ON notificacao_receita
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "nr_update" ON notificacao_receita
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador','gestor','atendente'))
  WITH CHECK (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "nr_delete" ON notificacao_receita
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

CREATE INDEX IF NOT EXISTS idx_nr_numero ON notificacao_receita(numero);
CREATE INDEX IF NOT EXISTS idx_nr_data_disp ON notificacao_receita(data_dispensacao);

CREATE TRIGGER audit_notificacao_receita
  AFTER INSERT OR UPDATE OR DELETE ON notificacao_receita
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- ----------------------------------------------------------------
-- 3. BMPO — Balanço de Medicamentos Psicoativos (Art. 64)
--    Snapshot do balanço fechado por período.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bmpo_balancos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,            -- trimestral | anual
  ano integer NOT NULL,
  trimestre integer,             -- 1..4 (null se anual)
  lista text,                    -- lista da portaria ou 'todas'
  data_inicio date,
  data_fim date,
  status text DEFAULT 'aberto',  -- aberto | fechado
  dados jsonb,                   -- snapshot por item: estoque_ant, entradas, saidas, perdas, saldo
  observacao text,
  gerado_por uuid REFERENCES users(id),
  gerado_em timestamptz DEFAULT now()
);

ALTER TABLE bmpo_balancos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bmpo_select" ON bmpo_balancos
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador','gestor','atendente'));
CREATE POLICY "bmpo_insert" ON bmpo_balancos
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));
CREATE POLICY "bmpo_update" ON bmpo_balancos
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador','gestor'))
  WITH CHECK (auth_user_role() IN ('administrador','gestor'));
CREATE POLICY "bmpo_delete" ON bmpo_balancos
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

CREATE TRIGGER audit_bmpo_balancos
  AFTER INSERT OR UPDATE OR DELETE ON bmpo_balancos
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
