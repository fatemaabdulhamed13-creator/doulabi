-- Collections: named, orderable, admin-managed lists of products.
-- Replaces products.is_featured as the mechanism behind curated homepage
-- sections. A product can belong to more than one collection (or none),
-- and collections themselves can be added, renamed, reordered, or retired
-- entirely from Supabase Studio (or a future admin page) without any app
-- code changes — only the `slug` a screen queries by needs to stay put.

create table if not exists public.collections (
  id          uuid        primary key default gen_random_uuid(),
  slug        text        not null unique,
  name        text        not null,
  is_active   boolean     not null default true,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid        not null references public.collections (id) on delete cascade,
  product_id    uuid        not null references public.products (id) on delete cascade,
  sort_order    int         not null default 0,
  created_at    timestamptz not null default now(),
  primary key (collection_id, product_id)
);

-- The primary key above only indexes (collection_id, product_id) leading
-- with collection_id — this covers the reverse lookup ("which
-- collections is this product in"), e.g. for a future admin UI.
create index if not exists collection_products_product_id_idx
  on public.collection_products (product_id);

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

-- Collections/collection_products: public read, same as products —
-- the storefront apps read these as an anon-key client.
create policy "collections_select_public"
  on public.collections for select
  using (true);

create policy "collection_products_select_public"
  on public.collection_products for select
  using (true);

-- Writes are admin-only (same is_admin check as products_update_admin) —
-- curation happens from Supabase Studio or a future admin page
-- authenticated as an admin profile, never from the storefront apps.
create policy "collections_insert_admin"
  on public.collections for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "collections_update_admin"
  on public.collections for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "collections_delete_admin"
  on public.collections for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "collection_products_insert_admin"
  on public.collection_products for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "collection_products_update_admin"
  on public.collection_products for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "collection_products_delete_admin"
  on public.collection_products for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Seed the two homepage sections that used to both read
-- products.is_featured (the carousel and the "مفضلات دولابي" row) from
-- its current data, so nothing on the homepage changes the moment this
-- migration runs. Recurate either one independently afterward by editing
-- collection_products — is_featured itself is left in place, unused, in
-- case anything still needs it; safe to drop later once you've confirmed
-- everything reads from collections instead.
insert into public.collections (slug, name, sort_order) values
  ('home-carousel', 'مختارات دولابي', 1),
  ('home-favorites', 'مفضلات دولابي', 2)
on conflict (slug) do nothing;

insert into public.collection_products (collection_id, product_id)
select c.id, p.id
from public.products p
cross join public.collections c
where p.is_featured = true
  and c.slug in ('home-carousel', 'home-favorites')
on conflict (collection_id, product_id) do nothing;
