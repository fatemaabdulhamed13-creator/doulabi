-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Mobile Push Notifications
-- Adds device token storage (mobile only — iOS/Android, no web push) and a
-- history log of admin-broadcast notification campaigns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Device tokens ─────────────────────────────────────────────────────────
--
-- One row per installed app instance. `push_token` is the Expo push token
-- (Expo brokers delivery to APNs/FCM under the hood, so we never talk to
-- Apple/Google directly). `user_id` is nullable so a device can register
-- before the owner logs in; AuthContext backfills it on sign-in.

create table if not exists public.device_tokens (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references public.profiles (id) on delete cascade,
  platform       text        not null check (platform in ('ios', 'android')),
  push_token     text        not null unique,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_used_at   timestamptz not null default now()
);

create index if not exists idx_device_tokens_active_platform
  on public.device_tokens (platform)
  where is_active = true;

create index if not exists idx_device_tokens_user
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Owner can register/refresh their own device (upsert on push_token).
create policy "device_tokens_insert_owner"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "device_tokens_update_owner"
  on public.device_tokens for update
  using (auth.uid() = user_id);

-- Admins can read every token (needed to build a send list) and deactivate
-- any token the push provider reports as invalid/expired.
create policy "device_tokens_select_admin"
  on public.device_tokens for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "device_tokens_update_admin"
  on public.device_tokens for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ── 2. Notification campaign history ────────────────────────────────────────

create table if not exists public.notification_campaigns (
  id                uuid        primary key default gen_random_uuid(),
  title             text        not null,
  body              text        not null,
  data              jsonb,
  target_platform   text        not null check (target_platform in ('all', 'ios', 'android')),
  total_recipients  integer     not null default 0,
  success_count     integer     not null default 0,
  failure_count     integer     not null default 0,
  sent_by           uuid        references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_notification_campaigns_created
  on public.notification_campaigns (created_at desc);

alter table public.notification_campaigns enable row level security;

create policy "notification_campaigns_select_admin"
  on public.notification_campaigns for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "notification_campaigns_insert_admin"
  on public.notification_campaigns for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
