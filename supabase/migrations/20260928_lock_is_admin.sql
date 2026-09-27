-- Users can insert/update their own profile row, but must never be able to
-- grant themselves admin. Logged-in callers (web, app, or direct API) have
-- is_admin forced to false on insert and left unchanged on update.
-- The dashboard / SQL editor / service role have no auth.uid(), so admins
-- can still be granted there.

create or replace function public.protect_is_admin()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_admin on public.profiles;

create trigger protect_is_admin
  before insert or update on public.profiles
  for each row
  execute function public.protect_is_admin();
