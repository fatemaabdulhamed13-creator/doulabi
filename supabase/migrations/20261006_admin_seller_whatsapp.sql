-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: admin-only WhatsApp lookup for the web admin page
--
-- The admin page needs sellers' numbers (to contact them about a listing),
-- but profiles.whatsapp_number isn't readable by logged-in users
-- (20261001b_lock_whatsapp_column.sql) — admins included, since column
-- privileges are per role, not per user. The page was switched to the
-- service-role key for this, which made it depend on that key being set in
-- the hosting environment. This function removes that dependency: it returns
-- numbers for the given sellers only when the caller is an admin.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_seller_whatsapp(p_seller_ids uuid[])
returns table (id uuid, whatsapp_number text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.whatsapp_number
  from public.profiles pr
  where pr.id = any (p_seller_ids)
    and exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin);
$$;

revoke all on function public.admin_seller_whatsapp(uuid[]) from public, anon;
grant execute on function public.admin_seller_whatsapp(uuid[]) to authenticated;
