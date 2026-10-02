-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix push-token registration; one report per user per listing
--
-- Found by an end-to-end test on 2026-10-03.
--
-- 1. Push tokens. The app saved its token with an upsert (insert … on
--    conflict do update). Postgres also applies a table's SELECT policies to
--    upserts, and device_tokens only had an admin SELECT policy — so every
--    non-admin registration failed with "new row violates row-level security
--    policy". Only the admin's phone ever registered, meaning nobody else
--    could receive push notifications (e.g. "listing approved").
--    Also, a phone that switches accounts keeps the same token, whose row
--    belongs to the previous account and couldn't be taken over.
--    register_device_token() handles both: it registers the calling user's
--    token and reassigns the row if the device previously belonged to
--    someone else. The app calls this instead of writing the table.
--
-- 2. Reports. The app treats a duplicate report as "already reported"
--    (unique violation 23505), but the table had no unique constraint, so
--    repeat reports were stored. Existing duplicates are removed (keeping
--    the earliest) before the constraint is added.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Push tokens ──────────────────────────────────────────────────────────
create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;

  insert into public.device_tokens (user_id, platform, push_token, is_active, updated_at, last_used_at)
  values (auth.uid(), p_platform, p_token, true, now(), now())
  on conflict (push_token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        is_active    = true,
        updated_at   = now(),
        last_used_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

-- Users can see their own tokens (admins already can via the admin policy).
drop policy if exists "device_tokens_select_owner" on public.device_tokens;
create policy "device_tokens_select_owner"
  on public.device_tokens for select
  using (user_id = (select auth.uid()));

-- ── 2. One report per user per listing ──────────────────────────────────────
delete from public.reports r
using public.reports older
where r.reporter_id = older.reporter_id
  and r.product_id  = older.product_id
  and (r.created_at, r.id) > (older.created_at, older.id);

create unique index if not exists reports_one_per_user_per_product
  on public.reports (reporter_id, product_id);
