-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Most-liked products (home "الأكثر إعجاباً" row + most-liked page)
--
-- Restored 2026-10-01 from the live database (pg_get_functiondef) — the
-- previous copy of this file was damaged. Already applied; kept for the
-- record. The block check was added later in 20261003_advisor_fixes.sql.
--
-- SECURITY DEFINER because it counts every user's favorites, which RLS
-- would otherwise hide (favorites are owner-only). It filters to approved,
-- unsold listings itself and excludes sellers liking their own items.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_most_liked_products(min_likes integer default 2, max_results integer default 12)
returns table(id uuid, title text, price numeric, brand text, size_value text, image_urls text[], likes bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.title, p.price, p.brand, p.size_value, p.image_urls, count(*) as likes
  from favorites f
  join products p on p.id = f.product_id
  where f.user_id <> p.seller_id
    and p.status = 'approved'
    and p.is_sold = false
  group by p.id
  having count(*) >= greatest(min_likes, 1)
  order by likes desc, p.created_at desc
  limit least(greatest(max_results, 1), 50);
$$;
