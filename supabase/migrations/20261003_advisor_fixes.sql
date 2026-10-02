-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Supabase Advisor fixes (safe, behavior-preserving)
--
-- From `supabase db advisors` on 2026-10-01. Nothing here changes who can
-- see or do what — except (4), which narrows a function to only what the
-- app needs.
--
--   1. auth_rls_initplan (33 policies): auth.uid() inside a policy was
--      re-evaluated for every row. Wrapping it as (select auth.uid()) makes
--      Postgres evaluate it once per query. Rewritten in place with ALTER
--      POLICY, reading each policy's live expression — several policies
--      were created in the dashboard and aren't in these migrations, so
--      they're not retyped by hand. Same logic, just faster.
--   2. unindexed_foreign_keys (5): indexes for the joins/deletes that use
--      these columns.
--   3. function_search_path_mutable (2): pin search_path.
--   4. is_blocked_between(a, b) could be called with ANY two accounts,
--      letting a user check whether two other people blocked each other.
--      Replaced by is_blocked_with(other), which always checks against the
--      caller. The products policy and get_seller_whatsapp() switch to it.
--   5. get_most_liked_products() is SECURITY DEFINER (it must count
--      everyone's favorites), so the block policy didn't apply to it —
--      the block check is now inside it.
--   0. multiple_permissive_policies (37 warnings): duplicate policies,
--      several created in the dashboard, merged — one policy per table per
--      action, same logic (verified against the live definitions). Only
--      change: favorites loses the unused ability to UPDATE a row (it came
--      from a catch-all "ALL" policy; the app only inserts/deletes).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Merge duplicate policies ─────────────────────────────────────────────
-- favorites: the "ALL" policy duplicated the three per-action owner ones.
drop policy if exists "Users can manage their own favorites" on public.favorites;

-- products SELECT: approved OR own OR admin, as one policy (was three).
drop policy if exists "products_select_approved" on public.products;
drop policy if exists "products_select_own" on public.products;
drop policy if exists "products_select_admin" on public.products;
create policy "products_select"
  on public.products for select
  using (
    status = 'approved'
    or seller_id = (select auth.uid())
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin)
  );

-- products UPDATE: owner OR admin, as one policy (was three — two of them
-- identical admin policies). Column-level rules (status resets, locked
-- fields) are still enforced by the enforce_product_edit_rules trigger.
drop policy if exists "Admins can update product status" on public.products;
drop policy if exists "products_update_admin" on public.products;
drop policy if exists "products_update_owner" on public.products;
create policy "products_update"
  on public.products for update
  using (
    seller_id = (select auth.uid())
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin)
  );

-- profiles UPDATE: two identical owner policies; keep the stricter one
-- (authenticated only, with an explicit check).
drop policy if exists "profiles_update_owner" on public.profiles;

-- ── 1. Evaluate auth.uid() once per query, not per row ──────────────────────
do $$
declare
  p record;
  new_qual text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
  loop
    -- Skip occurrences already wrapped — pg_policies prints those as
    -- "( SELECT auth.uid() AS uid)".
    new_qual  := regexp_replace(p.qual,       '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    new_check := regexp_replace(p.with_check, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');

    if new_qual is not distinct from p.qual and new_check is not distinct from p.with_check then
      continue;
    end if;

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if p.with_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
  end loop;
end $$;

-- ── 2. Foreign-key indexes ──────────────────────────────────────────────────
create index if not exists idx_favorites_product_id            on public.favorites (product_id);
create index if not exists idx_products_seller_id              on public.products (seller_id);
create index if not exists idx_reports_product_id              on public.reports (product_id);
create index if not exists idx_reports_reporter_id             on public.reports (reporter_id);
create index if not exists idx_notification_campaigns_sent_by  on public.notification_campaigns (sent_by);

-- ── 3. Pin search_path ──────────────────────────────────────────────────────
-- Both only use built-ins (lower/translate/regexp_replace/now), which live
-- in pg_catalog and resolve with an empty search_path.
alter function public.normalize_ar(text) set search_path = '';
alter function public.set_products_sold_at() set search_path = '';

-- ── 4. Block check that can only ask about yourself ─────────────────────────
create or replace function public.is_blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

revoke all on function public.is_blocked_with(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;

drop policy if exists "products_hide_blocked" on public.products;
create policy "products_hide_blocked"
  on public.products
  as restrictive
  for select
  to authenticated
  using (not public.is_blocked_with(seller_id));

create or replace function public.get_seller_whatsapp(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pr.whatsapp_number
  from public.products p
  join public.profiles pr on pr.id = p.seller_id
  where p.id = p_product_id
    and auth.uid() is not null
    and not public.is_blocked_with(p.seller_id)
    and (
      (p.status = 'approved' and not p.is_sold)
      or p.seller_id = auth.uid()
      or exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin)
    );
$$;

drop function if exists public.is_blocked_between(uuid, uuid);

-- ── 5. Most Liked respects blocks ───────────────────────────────────────────
-- Same as the live definition, plus the block check. For logged-out
-- visitors auth.uid() is null, so is_blocked_with() is simply false.
create or replace function public.get_most_liked_products(min_likes integer default 2, max_results integer default 12)
returns table(id uuid, title text, price numeric, brand text, size_value text, image_urls text[], likes bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.title, p.price, p.brand, p.size_value, p.image_urls, count(*) as likes
  from favorites f
  join products p on p.id = f.product_id
  where f.user_id <> p.seller_id
    and p.status = 'approved'
    and p.is_sold = false
    and not public.is_blocked_with(p.seller_id)
  group by p.id
  having count(*) >= greatest(min_likes, 1)
  order by likes desc, p.created_at desc
  limit least(greatest(max_results, 1), 50);
$$;
