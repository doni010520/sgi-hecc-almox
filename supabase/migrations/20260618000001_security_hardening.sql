-- ================================================================
-- Security hardening: RLS, LGPD, audit triggers
-- LGPD Lei 13.709/2018 | CFM 1821/2007 | Portaria 344/98
-- ================================================================

-- ----------------------------------------------------------------
-- Helper: get current user's role (stable, avoids repeated joins)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- ----------------------------------------------------------------
-- 1. Fix overly permissive RLS on G2 pharmacy tables
--    (replace FOR ALL USING (true) with role-based policies)
-- ----------------------------------------------------------------

-- livros_controlados
DROP POLICY IF EXISTS "auth_read_livros" ON livros_controlados;
CREATE POLICY "livros_select" ON livros_controlados
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "livros_insert" ON livros_controlados
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor'));
CREATE POLICY "livros_update" ON livros_controlados
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor'));
-- DELETE denied for all — livro de controlados é registro imutável (Art. 7 Portaria 344/98)

-- talidomida_notifications
DROP POLICY IF EXISTS "auth_read_talidomida" ON talidomida_notifications;
CREATE POLICY "talidomida_select" ON talidomida_notifications
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "talidomida_insert" ON talidomida_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "talidomida_update" ON talidomida_notifications
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor'));
CREATE POLICY "talidomida_delete" ON talidomida_notifications
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- antimicrobial_controls
DROP POLICY IF EXISTS "auth_read_antimicrobial" ON antimicrobial_controls;
CREATE POLICY "antimicrobial_select" ON antimicrobial_controls
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "antimicrobial_insert" ON antimicrobial_controls
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "antimicrobial_update" ON antimicrobial_controls
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "antimicrobial_delete" ON antimicrobial_controls
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- pharmaceutical_interventions
DROP POLICY IF EXISTS "auth_read_interventions" ON pharmaceutical_interventions;
CREATE POLICY "interventions_select" ON pharmaceutical_interventions
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "interventions_insert" ON pharmaceutical_interventions
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "interventions_update" ON pharmaceutical_interventions
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "interventions_delete" ON pharmaceutical_interventions
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- loans
DROP POLICY IF EXISTS "auth_read_loans" ON loans;
CREATE POLICY "loans_select" ON loans
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loans_insert" ON loans
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loans_update" ON loans
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loans_delete" ON loans
  FOR DELETE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor'));

-- loan_items
DROP POLICY IF EXISTS "auth_read_loan_items" ON loan_items;
CREATE POLICY "loan_items_select" ON loan_items
  FOR SELECT TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loan_items_insert" ON loan_items
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loan_items_update" ON loan_items
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor', 'atendente'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor', 'atendente'));
CREATE POLICY "loan_items_delete" ON loan_items
  FOR DELETE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor'));

-- ----------------------------------------------------------------
-- 2. Explicit DELETE policies on existing sensitive tables
-- ----------------------------------------------------------------

-- users: apenas administrador pode excluir
DROP POLICY IF EXISTS "users_delete" ON users;
CREATE POLICY "users_delete" ON users
  FOR DELETE TO authenticated
  USING (auth_user_role() = 'administrador');

-- requests: solicitante exclui apenas rascunhos próprios; gestor/admin exclui qualquer
DROP POLICY IF EXISTS "requests_delete" ON requests;
CREATE POLICY "requests_delete" ON requests
  FOR DELETE TO authenticated
  USING (
    (requester_id = auth.uid() AND status = 'draft')
    OR auth_user_role() IN ('administrador', 'gestor')
  );

-- request_items: segue a mesma regra do pedido pai
DROP POLICY IF EXISTS "request_items_delete" ON request_items;
CREATE POLICY "request_items_delete" ON request_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_items.request_id
      AND (
        (r.requester_id = auth.uid() AND r.status = 'draft')
        OR auth_user_role() IN ('administrador', 'gestor')
      )
    )
  );

-- request_status_history: registro imutável — ninguém exclui
DROP POLICY IF EXISTS "request_status_history_delete" ON request_status_history;
CREATE POLICY "request_status_history_delete" ON request_status_history
  FOR DELETE TO authenticated
  USING (false);

-- audit_logs: registro imutável — ninguém exclui, nem administrador
DROP POLICY IF EXISTS "audit_logs_delete" ON audit_logs;
CREATE POLICY "audit_logs_delete" ON audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- ----------------------------------------------------------------
-- 3. Audit triggers para tabelas G2
-- ----------------------------------------------------------------

CREATE TRIGGER audit_livros_controlados
  AFTER INSERT OR UPDATE OR DELETE ON livros_controlados
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_talidomida_notifications
  AFTER INSERT OR UPDATE OR DELETE ON talidomida_notifications
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_antimicrobial_controls
  AFTER INSERT OR UPDATE OR DELETE ON antimicrobial_controls
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_pharmaceutical_interventions
  AFTER INSERT OR UPDATE OR DELETE ON pharmaceutical_interventions
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_loans
  AFTER INSERT OR UPDATE OR DELETE ON loans
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- ----------------------------------------------------------------
-- 4. LGPD — Lei 13.709/2018
-- ----------------------------------------------------------------

-- 4.1 Consentimento explícito do titular dos dados
CREATE TABLE IF NOT EXISTS lgpd_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz DEFAULT now(),
  -- Armazenados para prova de consentimento (Art. 8 §5 LGPD)
  ip_address inet,
  user_agent text,
  UNIQUE(user_id, version)
);

ALTER TABLE lgpd_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd_consents_select" ON lgpd_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth_user_role() IN ('administrador', 'gestor'));

CREATE POLICY "lgpd_consents_insert" ON lgpd_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Registros de consentimento são imutáveis (ninguém pode deletar)

-- 4.2 Solicitações dos titulares (Arts. 17-22 LGPD)
--     Prazo legal de resposta: 15 dias (Art. 19)
CREATE TABLE IF NOT EXISTS lgpd_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN (
    'acesso',          -- Art. 18 I   — confirmação e acesso
    'retificacao',     -- Art. 18 III — correção de dados inexatos
    'exclusao',        -- Art. 18 VI  — eliminação de dados desnecessários
    'portabilidade',   -- Art. 18 V   — portabilidade a outro fornecedor
    'restricao',       -- Art. 18 IV  — anonimização ou bloqueio
    'oposicao'         -- Art. 18 §2  — oposição ao tratamento
  )),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'indeferido')),
  details text,
  response text,
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES users(id)
);

ALTER TABLE lgpd_data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lgpd_requests_select" ON lgpd_data_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth_user_role() IN ('administrador', 'gestor'));

CREATE POLICY "lgpd_requests_insert" ON lgpd_data_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lgpd_requests_update" ON lgpd_data_requests
  FOR UPDATE TO authenticated
  USING (auth_user_role() IN ('administrador', 'gestor'))
  WITH CHECK (auth_user_role() IN ('administrador', 'gestor'));

-- 4.3 Índice para controle de prazo
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status
  ON lgpd_data_requests(status, requested_at)
  WHERE status IN ('pendente', 'em_andamento');

-- View auxiliar: prazo legal calculado (Art. 19 — 15 dias corridos)
CREATE OR REPLACE VIEW lgpd_data_requests_view AS
SELECT *, (requested_at + INTERVAL '15 days') AS deadline_at
FROM lgpd_data_requests;

-- 4.4 Audit triggers LGPD
CREATE TRIGGER audit_lgpd_consents
  AFTER INSERT OR UPDATE OR DELETE ON lgpd_consents
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

CREATE TRIGGER audit_lgpd_data_requests
  AFTER INSERT OR UPDATE OR DELETE ON lgpd_data_requests
  FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
