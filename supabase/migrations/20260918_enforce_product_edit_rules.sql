-- Server-side enforcement of listing edit rules by status, so this can't
-- be bypassed by calling Supabase directly instead of going through the
-- app's edit screens. See conversation: sellers should never be able to
-- self-approve/self-reject, and editing a "locked" field (title, category,
-- brand, condition, description, images) on an already-approved listing
-- should pull it back into the review queue rather than being blocked
-- outright or silently staying live with unreviewed changes.

create or replace function public.enforce_product_edit_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller_is_admin boolean;
  locked_field_changed boolean;
begin
  -- No authenticated user on this connection (service-role / direct DB
  -- access) — that already bypasses RLS, so don't layer extra
  -- restrictions on top of it here.
  if auth.uid() is null then
    return new;
  end if;

  select is_admin into caller_is_admin
  from public.profiles
  where id = auth.uid();

  -- Admin moderation actions (approve/reject, and edits made while
  -- approving) are unrestricted.
  if caller_is_admin then
    return new;
  end if;

  -- Still a draft: fully unrestricted, nothing to enforce yet.
  if old.status = 'draft' then
    return new;
  end if;

  locked_field_changed := (
    new.title       is distinct from old.title or
    new.category    is distinct from old.category or
    new.brand       is distinct from old.brand or
    new.condition   is distinct from old.condition or
    new.description is distinct from old.description or
    new.image_urls  is distinct from old.image_urls
  );

  if old.status in ('pending', 'rejected') then
    -- Freely editable pre-approval. A seller can never set status to
    -- 'approved' or 'rejected' themselves — any save here lands back in
    -- 'pending', which also means editing a rejected listing is treated
    -- as an implicit resubmission for review.
    new.status := 'pending';
    return new;
  end if;

  if old.status = 'approved' then
    -- Locked-field edits are allowed, not blocked, but pull the listing
    -- back into the review queue (and out of public search, via the
    -- existing status = 'approved' filters) until an admin re-approves it.
    if locked_field_changed then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
    return new;
  end if;

  -- Any other status: no seller-initiated status change recognized.
  new.status := old.status;
  return new;
end;
$$;

drop trigger if exists enforce_product_edit_rules on public.products;

create trigger enforce_product_edit_rules
  before update on public.products
  for each row
  execute function public.enforce_product_edit_rules();
