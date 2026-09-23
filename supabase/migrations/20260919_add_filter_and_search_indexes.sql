-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Filter + free-text search indexes
--
-- Builds on 20260804_add_performance_indexes.sql, which already covers the
-- status/is_sold/created_at storefront pattern and seller/favorites lookups.
-- This adds the columns search.tsx's filter sheet actually narrows by
-- (category, brand, size_value, condition, color, city), plus a proper index
-- for the free-text title/description search.
--
-- Note on the free-text search specifically: it uses `.ilike('%query%')` —
-- a *leading* wildcard. A standard B-tree index cannot accelerate that at
-- all (B-tree only helps `LIKE 'foo%'`, not `'%foo%'`), which is why this
-- needs pg_trgm's trigram index instead, a different tool for a different
-- job than the plain filter columns below.
--
-- No CONCURRENTLY here (unlike 20260804's migration) — it can't run inside
-- a transaction block, and the Supabase SQL Editor wraps a pasted script in
-- one. CONCURRENTLY exists to avoid locking a table under live production
-- traffic; at this table's current size that lock is milliseconds, so a
-- plain CREATE INDEX (paste-and-run in one shot) is the simpler trade-off
-- for now. Worth revisiting once the table is large and/or under real
-- concurrent write load.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Filter columns ───────────────────────────────────────────────────────────
--
-- Each filter in search.tsx's buildProductsQuery() can be applied alone or
-- combined arbitrarily with the others, so no single composite index covers
-- every combination — Postgres combines these via bitmap index scans when
-- several filters are active together, same as the storefront index already
-- narrows to approved+unsold rows first.
create index if not exists idx_products_category
  on public.products (category);

create index if not exists idx_products_brand
  on public.products (brand);

create index if not exists idx_products_size_value
  on public.products (size_value);

create index if not exists idx_products_condition
  on public.products (condition);

create index if not exists idx_products_color
  on public.products (color);

create index if not exists idx_products_city
  on public.products (city);

-- ── Free-text search ─────────────────────────────────────────────────────────
--
-- pg_trgm breaks text into overlapping 3-character sequences ("trigrams"),
-- which is what lets a GIN index accelerate a substring match like
-- '%query%' — a plain B-tree genuinely cannot do this, regardless of column.
create extension if not exists pg_trgm;

create index if not exists idx_products_title_trgm
  on public.products using gin (title gin_trgm_ops);

create index if not exists idx_products_description_trgm
  on public.products using gin (description gin_trgm_ops);
