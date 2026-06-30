-- =================================================================
-- VERSIONAMENTO — Schema drift de produção
-- =================================================================
-- Este arquivo documenta tabelas e colunas que já existem em
-- produção (aplicadas direto via dashboard Supabase). Todas as
-- operações são IDEMPOTENTES (IF NOT EXISTS) — rodar de novo é
-- no-op. Não destrutivo.
--
-- Origem: RESUMO-2026-06-30.md (entrada/saída em lote, dispensação
-- por requisição, cadastro de catálogo, unidades externas).
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Unidades externas (cadastro de fornecedores/parceiros externos)
--    Usado em "Registrar Saída" → destino, e em entradas
--    (empréstimo/doação/permuta/consignado vindos de fora).
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text,                 -- fornecedor | parceiro | hospital | outro
  cnpj text,
  endereco text,
  contato text,
  email text,
  telefone text,
  observacao text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_external_units_active ON external_units(is_active);
CREATE INDEX IF NOT EXISTS idx_external_units_nome ON external_units(nome);

-- -----------------------------------------------------------------
-- 2. stock_movements: destino da saída
--    Quando motivo é doação/permuta/empréstimo/etc., a saída carrega
--    para onde foi. destino_tipo: 'external_unit' | 'department' |
--    'supplier' | 'stock_location'.
-- -----------------------------------------------------------------
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS destino_tipo text;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS destino_nome text;

-- -----------------------------------------------------------------
-- 3. pharmacy_items / warehouse_items:
--    - allowed_department_ids: setores que podem solicitar este item
--      (vazio/null = todos). Filtro na tela de nova solicitação.
--    - padronizado: medicamento padronizado (badge no catálogo).
-- -----------------------------------------------------------------
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS allowed_department_ids uuid[];
ALTER TABLE pharmacy_items ADD COLUMN IF NOT EXISTS padronizado boolean NOT NULL DEFAULT false;

ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS allowed_department_ids uuid[];
ALTER TABLE warehouse_items ADD COLUMN IF NOT EXISTS padronizado boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------
-- 4. pharmacy_dispensations: tipo + confirmação de MAV
--    tipo = 'prescricao' (default) | 'requisicao' (só setor)
--    Em requisições, paciente/prescritor/n° prescrição não se
--    aplicam → colunas viram nuláveis.
-- -----------------------------------------------------------------
ALTER TABLE pharmacy_dispensations ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'prescricao';
ALTER TABLE pharmacy_dispensations ADD COLUMN IF NOT EXISTS mav_confirmado boolean NOT NULL DEFAULT false;

-- Tornar nuláveis para suportar tipo='requisicao'.
-- DROP NOT NULL é idempotente (no-op se já é nullable).
ALTER TABLE pharmacy_dispensations ALTER COLUMN patient_name DROP NOT NULL;
ALTER TABLE pharmacy_dispensations ALTER COLUMN prescribing_doctor DROP NOT NULL;
ALTER TABLE pharmacy_dispensations ALTER COLUMN prescription_number DROP NOT NULL;
ALTER TABLE pharmacy_dispensations ALTER COLUMN medical_record_number DROP NOT NULL;

-- Check de integridade: requisição precisa ter sector preenchido.
-- Idempotente via DROP+CREATE em bloco anônimo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_dispensation_requisicao_sector'
  ) THEN
    ALTER TABLE pharmacy_dispensations
      ADD CONSTRAINT chk_dispensation_requisicao_sector
      CHECK (tipo <> 'requisicao' OR (sector IS NOT NULL AND length(trim(sector)) > 0));
  END IF;
END$$;
