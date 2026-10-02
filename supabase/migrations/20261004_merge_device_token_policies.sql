-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: merge device_tokens UPDATE policies (Advisor:
-- multiple_permissive_policies). Same logic as the two policies from
-- 20260905_add_push_notifications.sql — owner OR admin — as one policy.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "device_tokens_update_owner" on public.device_tokens;
drop policy if exists "device_tokens_update_admin" on public.device_tokens;

create policy "device_tokens_update"
  on public.device_tokens for update
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin)
  );
