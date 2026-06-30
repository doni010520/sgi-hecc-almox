-- =================================================================
-- F2 — Catálogo: classificação múltipla
-- =================================================================
-- Adiciona pharmacy_items.medication_classes text[] e faz backfill
-- a partir do antigo medication_class (single). Idempotente.
--
-- A coluna medication_class é mantida por compatibilidade com a RPC
-- criar_dispensacao em produção que ainda lê o campo single. O
-- frontend grava AMBOS: medication_classes (array completo) e
-- medication_class (primeira classe). Quando a RPC for atualizada
-- para olhar o array, a coluna single poderá ser descartada.
-- =================================================================

ALTER TABLE pharmacy_items
  ADD COLUMN IF NOT EXISTS medication_classes text[];

-- Backfill: copia o valor single existente para o array onde
-- ainda não há array preenchido.
UPDATE pharmacy_items
   SET medication_classes = ARRAY[medication_class]
 WHERE medication_class IS NOT NULL
   AND (medication_classes IS NULL OR cardinality(medication_classes) = 0);

CREATE INDEX IF NOT EXISTS idx_pharmacy_items_classes
  ON pharmacy_items USING gin (medication_classes);
