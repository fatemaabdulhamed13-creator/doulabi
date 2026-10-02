-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 2 of 2: lock profiles.whatsapp_number
--
-- Run ONLY after the web + mobile builds that use get_seller_whatsapp() /
-- get_my_whatsapp() (20261001_whatsapp_functions.sql) are live.
--
-- Postgres column privileges are all-or-nothing per column, so this revokes
-- table-wide SELECT from logged-in users and re-grants every column EXCEPT
-- whatsapp_number. The column list is read from the live table rather than
-- hard-coded, because some profile columns were added outside migrations.
-- Writes (insert/update of your own row, enforced by RLS) are unaffected.
-- The web admin page reads numbers with the service-role client instead.
--
-- To undo: grant select on public.profiles to authenticated;
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name <> 'whatsapp_number';

  execute 'revoke select on public.profiles from authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
end $$;
