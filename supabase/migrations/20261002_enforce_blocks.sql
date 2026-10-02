-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: make blocking actually do something
--
-- Until now a block was only recorded — nothing read the blocks table, so a
-- blocked account could still see the blocker's listings and get their
-- WhatsApp number, despite the app promising otherwise. This enforces it in
-- the database, both directions, so every screen (search, home, collections,
-- most liked, favorites, profiles — web and mobile) follows automatically:
--
--   1. Listings: a logged-in user never sees listings from someone they
--      blocked, or from someone who blocked them.
--   2. WhatsApp: get_seller_whatsapp() returns nothing between them.
--   3. Unblocking: users can delete their own blocks.
--
-- Logged-out browsing is unaffected (a block is between two accounts).
-- Safe to run any time; independent of 20261001b_lock_whatsapp_column.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- The primary key (blocker_id, blocked_id) covers "who did I block"; this
-- covers the reverse lookup "who blocked me", used on every product read.
create index if not exists idx_blocks_blocked on public.blocks (blocked_id);

drop policy if exists "Users can delete own blocks" on public.blocks;
create policy "Users can delete own blocks"
  on public.blocks for delete
  using (blocker_id = (select auth.uid()));

-- One place for "are these two accounts blocked either way?". security
-- definer: RLS on blocks only lets you see blocks YOU made, but hiding also
-- has to work for blocks made against you.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- RESTRICTIVE: combined with AND on top of the existing select policies
-- (approved / own / admin), so it can only ever hide rows, never reveal.
drop policy if exists "products_hide_blocked" on public.products;
create policy "products_hide_blocked"
  on public.products
  as restrictive
  for select
  to authenticated
  using (not public.is_blocked_between((select auth.uid()), seller_id));

-- Same function as 20261001_whatsapp_functions.sql, plus the block check.
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
    and not public.is_blocked_between(auth.uid(), p.seller_id)
    and (
      (p.status = 'approved' and not p.is_sold)
      or p.seller_id = auth.uid()
      or exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin)
    );
$$;
