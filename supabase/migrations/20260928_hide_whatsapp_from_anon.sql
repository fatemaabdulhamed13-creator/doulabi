-- Logged-out visitors (the public anon key) can no longer read phone numbers.
-- Logged-in users still can — that's the intended "sign up to contact" gate.
--
-- Postgres can't revoke one column while a table-wide SELECT grant exists, so
-- the table grant is replaced with an explicit column list. Any column added
-- to profiles later is NOT readable by anon until it's added here.
-- is_admin must stay readable: the products admin-read policy checks it for
-- every caller, including anon.

revoke select on public.profiles from anon;

grant select (id, full_name, name, avatar_url, bio, city, created_at, is_admin)
  on public.profiles to anon;
