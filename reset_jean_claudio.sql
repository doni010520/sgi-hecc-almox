-- ============================================================
-- Reset de senha do Jean Claudio
-- ------------------------------------------------------------
-- Senha padrao definida: Hecc@2026
-- Apos o login com essa senha, o sistema redireciona automaticamente
-- para /change-password (graças ao must_change_password = true).
-- ============================================================
-- Execute no SQL Editor do Supabase (com role service_role / owner).

-- 1) Confirme antes que existe apenas um usuario com esse nome:
SELECT id, email, full_name, role, is_active
FROM public.users
WHERE full_name ILIKE '%Jean%Claudio%';

-- 2) Reset da senha no Supabase Auth (usa pgcrypto, ja habilitado no Supabase):
UPDATE auth.users
SET encrypted_password = crypt('Hecc@2026', gen_salt('bf')),
    updated_at = now()
WHERE id = (
  SELECT id FROM public.users
  WHERE full_name ILIKE '%Jean%Claudio%'
  LIMIT 1
);

-- 3) Forca a troca de senha no proximo login:
UPDATE public.users
SET must_change_password = true,
    updated_at = now()
WHERE full_name ILIKE '%Jean%Claudio%';

-- 4) Verificacao final:
SELECT u.id, u.email, u.full_name, u.must_change_password, a.updated_at AS auth_updated_at
FROM public.users u
JOIN auth.users a ON a.id = u.id
WHERE u.full_name ILIKE '%Jean%Claudio%';
