-- ================================================================
-- G2 - Farmácia v2 migration
-- Portaria 344/98, SESAB 737/2025, RDC 471/2021, RDC 11/2011
-- ================================================================

-- ----------------------------------------------------------------
-- 1.1 Cadastros
-- ----------------------------------------------------------------

-- patients: endereço (para Talidomida RDC 11/2011)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS endereco text;

-- pharmacy_items: DCB, nome comercial, requer justificativa, talidomida
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS dcb text;
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS nome_comercial text;
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS requires_justification boolean DEFAULT false;
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS is_talidomida boolean DEFAULT false;

-- controlled_subclass: add C5 if column is text (safe approach)
-- (No change needed - column is text type, C5 can be stored freely)

-- ----------------------------------------------------------------
-- 1.2 Escrituração de controlados (Portaria 344/98 Art. 7)
-- ----------------------------------------------------------------

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notificacao_receita_tipo text;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notificacao_receita_numero text;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS historico text;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS livro_seq integer;

CREATE TABLE IF NOT EXISTS livros_controlados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista text NOT NULL,
  termo_abertura_data date,
  termo_abertura_by uuid REFERENCES users(id),
  termo_encerramento_data date,
  termo_encerramento_by uuid REFERENCES users(id),
  status text DEFAULT 'aberto',
  folhas integer,
  cnpj text,
  razao_social text,
  created_at timestamptz DEFAULT now()
);

-- Auto-increment livro_seq per lista when item is controlado
CREATE OR REPLACE FUNCTION fn_set_livro_seq()
RETURNS TRIGGER AS $$
DECLARE
  v_is_controlado boolean;
  v_lista text;
  v_seq integer;
BEGIN
  -- Check if item being moved is a controlled substance
  SELECT
    pi.medication_class = 'controlados',
    pi.controlled_subclass
  INTO v_is_controlado, v_lista
  FROM pharmacy_items pi
  WHERE pi.id = NEW.item_id;

  IF v_is_controlado AND v_lista IS NOT NULL THEN
    SELECT COALESCE(MAX(livro_seq), 0) + 1
    INTO v_seq
    FROM stock_movements
    WHERE livro_seq IS NOT NULL
      AND item_id IN (
        SELECT id FROM pharmacy_items
        WHERE controlled_subclass = v_lista
      );
    NEW.livro_seq := v_seq;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_livro_seq ON stock_movements;
CREATE TRIGGER trg_livro_seq
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION fn_set_livro_seq();

-- ----------------------------------------------------------------
-- 1.3 Talidomida (RDC 11/2011) - completo
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS talidomida_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id uuid REFERENCES pharmacy_dispensations(id),
  data_dispensacao date NOT NULL,
  paciente_nome text NOT NULL,
  paciente_idade integer,
  paciente_sexo text,
  cid text,
  quantidade_comprimidos integer NOT NULL,
  medico_nome text,
  medico_crm text,
  tecnico_responsavel_id uuid REFERENCES users(id),
  termo_responsabilidade_paciente boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 1.4 Antimicrobianos (Anexo I + RDC 471/2021)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS antimicrobial_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id uuid REFERENCES pharmacy_dispensations(id),
  paciente_nome text NOT NULL,
  prontuario text,
  setor_leito text,
  data_internacao date,
  dias_internacao integer,
  status_paciente text,
  data_alta_obito date,
  antibiotico_item_id uuid REFERENCES pharmacy_items(id),
  antibiotico_nome text,
  via text,
  indicacao text,
  justificativa text,
  origem_infeccao text,
  dose text,
  posologia text,
  tempo_previsto_dias integer,
  data_inicio date,
  data_final_prevista date,
  prescritor text,
  dias_em_uso integer,
  data_final date,
  status_antimicrobiano text,
  data_ultima_atualizacao date,
  observacoes text,
  ccih_data_avaliacao date,
  ccih_parecer text,
  ccih_observacao text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 1.5 Intervenção Farmacêutica
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pharmaceutical_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  paciente text,
  unidade text,
  leito text,
  prontuario text,
  contato text,
  prm text,
  causa text,
  tipo_intervencao text,
  medicamento text,
  descricao text,
  acatado text,
  justificativa text,
  desfecho_clinico text,
  gravidade text,
  farmaceutico text,
  data_ultima_verificacao date,
  observacao text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------
-- 1.6 Devolução da Enfermagem
-- ----------------------------------------------------------------

ALTER TABLE stock_returns ADD COLUMN IF NOT EXISTS observacao text;

-- ----------------------------------------------------------------
-- 1.7 Empréstimos
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number serial,
  destino text NOT NULL,
  categoria text NOT NULL DEFAULT 'emprestimo',
  status text NOT NULL DEFAULT 'pending',
  observacao text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  item_id uuid REFERENCES pharmacy_items(id),
  item_nome text NOT NULL,
  batch_number text,
  expiry_date date,
  quantity integer NOT NULL,
  valor_unit numeric,
  valor_total numeric
);

-- ----------------------------------------------------------------
-- 1.8 Solicitações entre estoques
-- ----------------------------------------------------------------

ALTER TABLE requests ADD COLUMN IF NOT EXISTS needs_receipt_confirmation boolean DEFAULT false;

-- ----------------------------------------------------------------
-- 1.9 Entrada NF flexível
-- ----------------------------------------------------------------

ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE stock_entries ADD COLUMN IF NOT EXISTS observacao text;

-- Make invoice_number optional (nullable)
ALTER TABLE stock_entries ALTER COLUMN invoice_number DROP NOT NULL;

-- ----------------------------------------------------------------
-- 1.10 Dispensação: prescription_date + pending_approval support
-- ----------------------------------------------------------------

ALTER TABLE pharmacy_dispensations ADD COLUMN IF NOT EXISTS prescription_date date;
ALTER TABLE pharmacy_dispensations ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id);
ALTER TABLE pharmacy_dispensations ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Extend status to support pending_approval
-- (status column is text, so no enum change needed)

-- ----------------------------------------------------------------
-- RLS policies for new tables
-- ----------------------------------------------------------------

ALTER TABLE livros_controlados ENABLE ROW LEVEL SECURITY;
ALTER TABLE talidomida_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE antimicrobial_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmaceutical_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_items ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all new tables
DROP POLICY IF EXISTS "auth_read_livros" ON livros_controlados;
CREATE POLICY "auth_read_livros" ON livros_controlados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_talidomida" ON talidomida_notifications;
CREATE POLICY "auth_read_talidomida" ON talidomida_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_antimicrobial" ON antimicrobial_controls;
CREATE POLICY "auth_read_antimicrobial" ON antimicrobial_controls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_interventions" ON pharmaceutical_interventions;
CREATE POLICY "auth_read_interventions" ON pharmaceutical_interventions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_loans" ON loans;
CREATE POLICY "auth_read_loans" ON loans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_loan_items" ON loan_items;
CREATE POLICY "auth_read_loan_items" ON loan_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
