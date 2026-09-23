-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: sold_at timestamp
--
-- Adds products.sold_at and a trigger that sets it automatically whenever
-- is_sold flips true → false or false → true, so every place that toggles
-- is_sold (mobile's profile.tsx, web's markAsSoldAction/markAsAvailableAction)
-- gets this for free — no app-code changes needed, and no future call site
-- can forget to set it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.products add column if not exists sold_at timestamptz;

create or replace function public.set_products_sold_at()
returns trigger
language plpgsql
as $$
begin
  if new.is_sold and not old.is_sold then
    -- Marked as sold just now.
    new.sold_at := now();
  elsif not new.is_sold and old.is_sold then
    -- Unmarked — cleared so a later re-sale reflects that fresh timestamp,
    -- not a stale one from the first sale.
    new.sold_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_products_sold_at on public.products;

create trigger set_products_sold_at
  before update on public.products
  for each row
  execute function public.set_products_sold_at();
