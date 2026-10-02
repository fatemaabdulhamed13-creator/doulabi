-- Seasonal picks on the app's home screen, plus an optional caption.
--
--   caption       Optional short line shown under the collection's title —
--                 on its page and on its home-screen section. Null = none.
--   show_on_home  Puts the collection on Home (straight after the
--                 categories) while it's active. If several are switched on,
--                 the one with the lowest sort_order is shown.
--
-- Both are set from Supabase Studio (Table Editor → collections). Turning a
-- collection off (is_active = false, or show_on_home = false) removes it
-- from Home with no app update.

alter table public.collections
  add column if not exists caption text,
  add column if not exists show_on_home boolean not null default false;
