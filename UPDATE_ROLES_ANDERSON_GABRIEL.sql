-- =====================================================
-- Atualizar papéis: Anderson -> atendente, Gabriel -> solicitante
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1) Ver os usuários atuais (para confirmar antes de atualizar)
SELECT id, email, full_name, role
FROM public.users
WHERE full_name ILIKE '%anderson%' OR full_name ILIKE '%gabriel%';

-- 2) Atualizar Anderson -> atendente
UPDATE public.users
SET role = 'atendente',
    updated_at = NOW()
WHERE full_name ILIKE '%anderson%';

-- 3) Atualizar Gabriel -> solicitante
UPDATE public.users
SET role = 'solicitante',
    updated_at = NOW()
WHERE full_name ILIKE '%gabriel%';

-- 4) Confirmar o resultado
SELECT id, email, full_name, role, updated_at
FROM public.users
WHERE full_name ILIKE '%anderson%' OR full_name ILIKE '%gabriel%';
