-- 24/08/2026 — ISOLAMENTO ALMOXARIFADO x FARMACIA
--
-- Problema: almox_editar_lotes recalculava item_stocks de TODO local que tivesse
-- lote ou linha de estoque do item. Como 109 itens de almoxarifado tem lote em
-- SAT_T (Farmacia Satelite Terreo), editar um lote pelo Almoxarifado reescrevia
-- o saldo de um estoque da FARMACIA.
--
-- Alem disso, lote inserido sem location_id caia no default global do trigger
-- trg_expiry_tracking_default_local, que aponta pra CAF (Central de
-- Abastecimento Farmaceutico) — outro vazamento almox -> farmacia.
--
-- Correcao: a funcao passa a (a) usar ALMOX como local padrao dos lotes que ela
-- cria, e (b) recalcular item_stocks SOMENTE dos locais efetivamente tocados
-- nesta chamada. Nenhum outro local e escrito.
-- O trigger global (CAF) fica intacto — e o default correto para a farmacia.

create or replace function public.almox_editar_lotes(p_item_id uuid, p_lots jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text;
  it jsonb;
  v_qty integer;
  v_almox uuid;
  v_loc uuid;
  v_locs uuid[] := '{}';
begin
  if v_uid is null then raise exception 'Usuario nao autenticado.'; end if;
  select role into v_role from public.users where id = v_uid;
  if coalesce(v_role,'') not in ('administrador','gestor','atendente','pharmacist','admin','manager') then
    raise exception 'Sem permissao para editar lotes.';
  end if;
  if not exists (select 1 from public.warehouse_items where id = p_item_id) then
    raise exception 'Material invalido.';
  end if;

  select id into v_almox from public.stock_locations where code = 'ALMOX';

  for it in select value from jsonb_array_elements(coalesce(p_lots, '[]'::jsonb))
  loop
    v_qty := coalesce(nullif(it->>'quantity','')::integer, 0);

    -- local atual do lote entra na lista de afetados (cobre mover/excluir)
    if nullif(it->>'id','') is not null then
      select location_id into v_loc
        from public.expiry_tracking where id = (it->>'id')::uuid and item_id = p_item_id;
      if v_loc is not null then v_locs := v_locs || v_loc; end if;
    end if;

    if coalesce((it->>'deleted')::boolean, false) then
      if nullif(it->>'id','') is not null then
        delete from public.expiry_tracking where id = (it->>'id')::uuid and item_id = p_item_id;
      end if;

    elsif nullif(it->>'id','') is not null then
      update public.expiry_tracking set
        batch_number = nullif(it->>'batch_number',''),
        expiry_date  = nullif(it->>'expiry_date','')::date,
        current_quantity = v_qty
      where id = (it->>'id')::uuid and item_id = p_item_id
      returning location_id into v_loc;
      if v_loc is not null then v_locs := v_locs || v_loc; end if;

    else
      -- ALMOX como default: sem isso o trigger global jogaria o lote em CAF
      insert into public.expiry_tracking(item_id, batch_number, expiry_date,
        initial_quantity, current_quantity, location_id, created_by)
      values (p_item_id, nullif(it->>'batch_number',''), nullif(it->>'expiry_date','')::date,
        v_qty, v_qty, coalesce(nullif(it->>'location_id','')::uuid, v_almox), v_uid)
      returning location_id into v_loc;
      if v_loc is not null then v_locs := v_locs || v_loc; end if;
    end if;
  end loop;

  -- Recalcula SOMENTE os locais tocados nesta chamada.
  insert into public.item_stocks(item_id, item_type, location_id, quantity)
  select p_item_id, 'warehouse', l.loc,
         coalesce((select sum(current_quantity) from public.expiry_tracking et
                   where et.item_id = p_item_id and et.location_id = l.loc), 0)
  from (select distinct unnest(v_locs) loc) l
  where l.loc is not null
  on conflict (item_id, item_type, location_id)
  do update set quantity = excluded.quantity, updated_at = now();

  return jsonb_build_object('ok', true, 'item_id', p_item_id,
                            'locais_recalculados', coalesce(array_length(v_locs,1),0));
exception
  when foreign_key_violation then
    raise exception 'Nao da para excluir um lote que ja foi usado em movimentacao. Zere a quantidade em vez de excluir.';
end
$fn$;
