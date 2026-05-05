-- ─────────────────────────────────────────────────────────────────────────────
-- Doulabi Marketplace — Database Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Profiles ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id               uuid        primary key references auth.users (id) on delete cascade,
  full_name        text        not null,
  whatsapp_number  text        not null,
  avatar_url       text,
  is_admin         boolean     not null default false,
  created_at       timestamptz not null default now()
);

-- ── 2. Products ──────────────────────────────────────────────────────────────

create table if not exists public.products (
  id                  uuid        primary key default gen_random_uuid(),
  seller_id           uuid        not null references public.profiles (id) on delete cascade,
  title               text        not null,
  price               numeric     not null,
  category            text        not null,
  brand               text        not null,
  size_type           text        not null,   -- 'letters' | 'numbers'
  size_value          text        not null,
  condition           text        not null,
  description         text,
  is_open_to_offers   boolean     not null default false,
  is_sold             boolean     not null default false,
  image_urls          text[]      not null default '{}',
  status              text        not null default 'pending',
  color               text,
  city                text,
  delivery_available  boolean     not null default false,
  created_at          timestamptz not null default now()
);

-- ── 3. Favorites ─────────────────────────────────────────────────────────────

create table if not exists public.favorites (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  product_id uuid        not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ── 4. Row Level Security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.products  enable row level security;

-- Profiles: public read
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Profiles: owner insert only
create policy "profiles_insert_owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Profiles: owner update only
create policy "profiles_update_owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Products: public read
create policy "products_select_public"
  on public.products for select
  using (true);

-- Products: authenticated insert
create policy "products_insert_authenticated"
  on public.products for insert
  with check (auth.role() = 'authenticated');

-- Products: owner update only
create policy "products_update_owner"
  on public.products for update
  using (auth.uid() = seller_id);

-- Products: admin can update any row (status changes)
create policy "products_update_admin"
  on public.products for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Products: owner delete only
create policy "products_delete_owner"
  on public.products for delete
  using (auth.uid() = seller_id);

-- Favorites RLS
alter table public.favorites enable row level security;

create policy "favorites_select_owner"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "favorites_insert_owner"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "favorites_delete_owner"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ── 5. Storage ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Storage: public read
create policy "storage_select_public"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Storage: authenticated upload
create policy "storage_insert_authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );
