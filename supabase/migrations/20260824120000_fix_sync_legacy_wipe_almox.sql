create or replace function public.fn_sync_legacy_stock_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
DECLARE
  loc_code text;
BEGIN
  SELECT code INTO loc_code FROM public.stock_locations WHERE id = NEW.location_id;

  IF NEW.item_type = 'pharmacy' AND loc_code = 'CAF' THEN
    UPDATE public.pharmacy_items
       SET current_stock = NEW.quantity,
           min_stock     = NEW.min_qty,
           max_stock     = NEW.max_qty,
           updated_at    = now()
     WHERE id = NEW.item_id;
  END IF;

  -- 24/08/2026 — ramo warehouse/ALMOX REMOVIDO.
  -- Ele espelhava item_stocks -> warehouse_items.current_stock/min_stock/max_stock.
  -- Como o almoxarifado roda no modelo legado (current_stock direto) e os dois
  -- modelos divergiam em 201 de 245 itens, qualquer escrita em item_stocks
  -- (ex.: RPC almox_editar_lotes recalculando pela soma dos lotes) zerava o
  -- saldo real. Causa dos 63 zeramentos entre 01/07 e 21/08.
  -- Para reverter: restaurar o ELSIF a partir da migration 20260618000000_g2_farmacia_v2.sql

  RETURN NEW;
END
$fn$;
