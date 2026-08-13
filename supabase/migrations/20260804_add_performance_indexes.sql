-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Performance Indexes
-- Eliminates full-table scans on the three most common query shapes.
--
-- All indexes use CONCURRENTLY so they build without acquiring a lock that
-- would block reads or writes. Run in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Index A: Storefront browsing ──────────────────────────────────────────────
--
-- Covers every query that filters by status (and optionally is_sold) and
-- then orders by created_at:
--   • Homepage:    status = 'approved'                   ORDER BY created_at DESC
--   • Search page: status = 'approved', is_sold = false  ORDER BY created_at DESC
--   • Admin panel: status = 'pending'                    ORDER BY created_at DESC
--
-- The DESC on created_at matches the sort direction so PostgreSQL can
-- satisfy ORDER BY from the index without an extra sort step.
create index concurrently if not exists idx_products_storefront
  on public.products (status, is_sold, created_at desc);

-- ── Index B: Seller profile lookups ──────────────────────────────────────────
--
-- Covers every query that filters by seller_id (with or without status/is_sold):
--   • /profile own listings:   seller_id = ?
--   • /profile/[id] public:    seller_id = ?, status = 'approved', is_sold = false
--   • COUNT(*) total:          seller_id = ?
--   • COUNT(*) sold:           seller_id = ?, is_sold = true
--
-- Leading with seller_id means all four query shapes hit the same index.
create index concurrently if not exists idx_products_seller
  on public.products (seller_id, status, is_sold, created_at desc);

-- ── Index C: Favorites page ordering ─────────────────────────────────────────
--
-- The composite PK (user_id, product_id) already handles the existence check
-- in toggleFavoriteAction. However the favorites page query is:
--   user_id = ? ORDER BY created_at DESC LIMIT N
--
-- The PK is ordered by product_id after user_id, so PostgreSQL cannot use it
-- for the ORDER BY and does a sort. This index makes the page query a pure
-- index scan with no sort step.
create index concurrently if not exists idx_favorites_user_created
  on public.favorites (user_id, created_at desc);
