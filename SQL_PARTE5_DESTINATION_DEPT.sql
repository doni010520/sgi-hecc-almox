-- Adicionar coluna destination_department_id na tabela requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS destination_department_id UUID REFERENCES departments(id);

-- Índice para consultas por setor de destino
CREATE INDEX IF NOT EXISTS idx_requests_destination_department_id ON requests(destination_department_id);
