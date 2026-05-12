-- Adiciona coluna batch_number (numero do lote) nas tabelas de itens
-- Execute este script no SQL Editor do Supabase

ALTER TABLE pharmacy_items
  ADD COLUMN IF NOT EXISTS batch_number text;

ALTER TABLE warehouse_items
  ADD COLUMN IF NOT EXISTS batch_number text;

-- expiry_date ja existe nas duas tabelas, nao precisa alterar.

-- Reset de senha do Jean Claudio para 'HECC@2025' e marca obrigatoriedade
-- de troca no proximo login. Execute apos confirmar o id correto.

-- 1) Confirme o usuario:
-- SELECT id, email, full_name, role FROM public.users WHERE full_name ILIKE '%Jean Claudio%';

-- 2) Atualize a senha no auth.users (requer extensao pgcrypto, ja habilitada no Supabase):
-- UPDATE auth.users
-- SET encrypted_password = crypt('HECC@2025', gen_salt('bf')),
--     updated_at = now()
-- WHERE id = (SELECT id FROM public.users WHERE full_name ILIKE '%Jean Claudio%' LIMIT 1);

-- 3) Marque must_change_password para forcar a troca:
-- UPDATE public.users
-- SET must_change_password = true,
--     updated_at = now()
-- WHERE full_name ILIKE '%Jean Claudio%';
