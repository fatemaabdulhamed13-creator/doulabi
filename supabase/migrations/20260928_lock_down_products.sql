-- Closes three holes in products access, all reachable by calling the
-- Supabase API directly with the public anon key:
--   1. Anyone could read pending/rejected listings (read policy was `using (true)`).
--   2. Sellers could insert a listing as another seller, or already 'approved'.
--   3. Sellers could self-approve via a 'draft' row, or reassign seller_id.
--
-- The live database has drifted from schema.sql, so existing read/insert
-- policies are dropped by command type rather than by name.

-- ── Replace read + insert policies ───────────────────────────────────────────
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'products' and cmd in ('SELECT', 'INSERT')
  loop
    execute format('drop policy %I on public.products', p.policyname);
  end loop;
end $$;

create policy "products_select_approved"
  on public.products for select
  using (status = 'approved');

create policy "products_select_own"
  on public.products for select
  using ((select auth.uid()) = seller_id);

create policy "products_select_admin"
  on public.products for select
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin));

create policy "products_insert_own"
  on public.products for insert
  with check ((select auth.uid()) = seller_id);

-- ── New listings always start in review ──────────────────────────────────────
create or replace function public.enforce_product_insert_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_product_insert_rules on public.products;

create trigger enforce_product_insert_rules
  before insert on public.products
  for each row
  execute function public.enforce_product_insert_rules();

-- ── Edits: no seller_id changes, no self-approval from 'draft' ───────────────
-- Same as 20260918_enforce_product_edit_rules.sql except: seller_id is locked
-- for non-admins, and 'draft' is treated like 'pending' instead of unrestricted.
create or replace function public.enforce_product_edit_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller_is_admin boolean;
  locked_field_changed boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select is_admin into caller_is_admin
  from public.profiles
  where id = auth.uid();

  if caller_is_admin then
    return new;
  end if;

  new.seller_id := old.seller_id;

  locked_field_changed := (
    new.title       is distinct from old.title or
    new.category    is distinct from old.category or
    new.brand       is distinct from old.brand or
    new.condition   is distinct from old.condition or
    new.description is distinct from old.description or
    new.image_urls  is distinct from old.image_urls
  );

  if old.status in ('draft', 'pending', 'rejected') then
    new.status := 'pending';
    return new;
  end if;

  if old.status = 'approved' then
    if locked_field_changed then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
    return new;
  end if;

  new.status := old.status;
  return new;
end;
$$;

drop trigger if exists enforce_product_edit_rules on public.products;

create trigger enforce_product_edit_rules
  before update on public.products
  for each row
  execute function public.enforce_product_edit_rules();
