-- Force-update / soft-nudge version gate for the mobile app. One row per
-- platform. minimum_version should only be raised deliberately, for a
-- release an old client genuinely can't run against safely (e.g. a
-- breaking backend change) — NOT for routine feature/design releases,
-- which should only bump latest_version (a dismissible "update available"
-- nudge — not yet implemented client-side; this migration only adds the
-- data a future client-side check would read).

create table if not exists public.app_config (
  platform        text        primary key,  -- 'ios' | 'android'
  minimum_version text        not null,
  latest_version  text        not null,
  store_url       text,
  update_message  text,
  updated_at      timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Public read — the app itself checks this as an anon-key client.
create policy "app_config_select_public"
  on public.app_config for select
  using (true);

-- Writes are admin-only, same is_admin check used everywhere else.
create policy "app_config_insert_admin"
  on public.app_config for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "app_config_update_admin"
  on public.app_config for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "app_config_delete_admin"
  on public.app_config for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Seeded permissively at today's shipped version — minimum_version equal
-- to the current app version means nothing is blocked. This only starts
-- doing anything once minimum_version is deliberately raised past what's
-- still installed on someone's device (see the comment at the top).
-- android's store_url is real (package name is fixed); ios's is left null
-- until the App Store Connect listing exists and has a numeric app id —
-- the client falls back to a generic App Store search in the meantime.
insert into public.app_config (platform, minimum_version, latest_version, store_url) values
  ('ios', '1.0.0', '1.0.0', null),
  ('android', '1.0.0', '1.0.0', 'https://play.google.com/store/apps/details?id=com.doulabi.app')
on conflict (platform) do nothing;
