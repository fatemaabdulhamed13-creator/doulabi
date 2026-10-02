-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 1 of 2: WhatsApp number access functions
--
-- 20260928_hide_whatsapp_from_anon.sql only hid profiles.whatsapp_number
-- from logged-OUT visitors. Any logged-in account could still run
-- `select whatsapp_number from profiles` and download every user's number,
-- buyers included. These two functions are the only paths the apps need:
--
--   get_seller_whatsapp(product_id) — a buyer contacting a seller. Returns
--     the number only when that listing is live (approved, not sold), or
--     to the listing's owner / an admin. Logged-in callers only.
--   get_my_whatsapp() — the caller's own number (profile edit screens).
--
-- APPLY ORDER: run this file first, deploy the web + mobile code that calls
-- these functions, THEN run 20261001b_lock_whatsapp_column.sql. Locking the
-- column before the code switches over breaks every WhatsApp button.
-- ─────────────────────────────────────────────────────────────────────────────

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
    and (
      (p.status = 'approved' and not p.is_sold)
      or p.seller_id = auth.uid()
      or exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin)
    );
$$;

create or replace function public.get_my_whatsapp()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select whatsapp_number from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_seller_whatsapp(uuid) from public, anon;
revoke all on function public.get_my_whatsapp() from public, anon;
grant execute on function public.get_seller_whatsapp(uuid) to authenticated;
grant execute on function public.get_my_whatsapp() to authenticated;
