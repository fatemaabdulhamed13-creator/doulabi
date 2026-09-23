-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: In-app notification inbox
-- One row per user per notification they were sent (listing approvals,
-- broadcast campaigns) — what the mobile app's bell/inbox screen reads.
-- Separate from `device_tokens` (which push actually goes to) and
-- `notification_campaigns` (the admin's own send-history audit log) — this
-- table is the recipient's-eye view, independent of whether the push
-- itself was delivered (a user with no registered device still gets an
-- inbox row, just no push).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles (id) on delete cascade,
  title       text        not null,
  body        text        not null,
  data        jsonb,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Inbox screen's own query shape: this user's rows, newest first.
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Owner can read and mark-as-read their own rows only.
create policy "notifications_select_owner"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update_owner"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Writes happen from admin-authenticated Server Actions only (approval
-- flow, broadcast compose) — same is_admin check as
-- notification_campaigns_insert_admin. Not restricted to inserting rows
-- for oneself, since the whole point is writing to *other* users' inboxes.
create policy "notifications_insert_admin"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );
