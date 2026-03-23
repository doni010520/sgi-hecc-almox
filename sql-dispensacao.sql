-- ============================================
-- SQL DISPENSAÇÃO - Executar no Supabase SQL Editor
-- ============================================

-- 1. Tabela principal de dispensações
CREATE TABLE pharmacy_dispensations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_number INTEGER UNIQUE NOT NULL DEFAULT 0,
  patient_name TEXT NOT NULL,
  patient_bed_room TEXT,
  medical_record_number TEXT NOT NULL,
  prescribing_doctor TEXT NOT NULL,
  prescription_number TEXT NOT NULL,
  sector TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT
);

CREATE INDEX idx_disp_patient ON pharmacy_dispensations(patient_name);
CREATE INDEX idx_disp_medical_record ON pharmacy_dispensations(medical_record_number);
CREATE INDEX idx_disp_created_at ON pharmacy_dispensations(created_at);

-- 2. Numeração sequencial automática
CREATE SEQUENCE dispensation_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_dispensation_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dispensation_number := nextval('dispensation_number_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dispensation_number
BEFORE INSERT ON pharmacy_dispensations
FOR EACH ROW EXECUTE FUNCTION generate_dispensation_number();

-- 3. Tabela de itens dispensados
CREATE TABLE pharmacy_dispensation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id UUID NOT NULL REFERENCES pharmacy_dispensations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES pharmacy_items(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disp_items_dispensation ON pharmacy_dispensation_items(dispensation_id);
CREATE INDEX idx_disp_items_item ON pharmacy_dispensation_items(item_id);

-- 4. Trigger de baixa automática no estoque
CREATE OR REPLACE FUNCTION deduct_pharmacy_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pharmacy_items
  SET current_stock = GREATEST(current_stock - NEW.quantity, 0)
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_stock_on_dispensation
AFTER INSERT ON pharmacy_dispensation_items
FOR EACH ROW EXECUTE FUNCTION deduct_pharmacy_stock();

-- 5. RLS
ALTER TABLE pharmacy_dispensations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dispensations" ON pharmacy_dispensations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dispensations" ON pharmacy_dispensations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dispensations" ON pharmacy_dispensations FOR UPDATE TO authenticated USING (true);

ALTER TABLE pharmacy_dispensation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read dispensation items" ON pharmacy_dispensation_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dispensation items" ON pharmacy_dispensation_items FOR INSERT TO authenticated WITH CHECK (true);
