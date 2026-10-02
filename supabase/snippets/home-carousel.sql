-- ─────────────────────────────────────────────────────────────────────────────
-- Home carousel — reference queries (NOT a migration; run pieces as needed
-- in Supabase → SQL Editor).
--
-- The carousel at the top of the app's Home screen shows the collection
-- with slug 'home-carousel':
--   • its first 8 products by sort_order (lowest first)
--   • only listings that are approved AND not sold — anything else in the
--     collection is silently skipped, so keep a few spares in it
--   • each listing's FIRST photo
--
-- Changes are live immediately (no app build or site deploy). Phones pick
-- them up on pull-to-refresh, or on their own within ~5 minutes.
--
-- Run ONE numbered block at a time. Replace the example IDs with real ones
-- (copy them from step 1 or 2).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. What's in the carousel right now ─────────────────────────────────────
-- "shown" = will actually appear (approved, unsold, within the first 8 live).
select
  cp.sort_order,
  p.id,
  p.title,
  p.price,
  p.status,
  p.is_sold,
  p.image_urls[1] as first_photo,
  (p.status = 'approved' and not p.is_sold) as shown
from collection_products cp
join collections c on c.id = cp.collection_id
join products p on p.id = cp.product_id
where c.slug = 'home-carousel'
order by cp.sort_order;


-- ── 2. Find listings to feature ─────────────────────────────────────────────
-- Latest approved, unsold listings. Add e.g.  and p.title ilike '%فستان%'
-- or  and p.category = 'فساتين'  to narrow it down. Open first_photo in a
-- browser to see the picture.
select p.id, p.title, p.price, p.category, p.image_urls[1] as first_photo, p.created_at
from products p
where p.status = 'approved' and not p.is_sold
order by p.created_at desc
limit 50;


-- ── 3. Add one listing (goes to the position you give it) ───────────────────
-- If it's already in the carousel, this just moves it to the new position.
insert into collection_products (collection_id, product_id, sort_order)
select c.id, '00000000-0000-0000-0000-000000000000', 1
from collections c
where c.slug = 'home-carousel'
on conflict (collection_id, product_id) do update set sort_order = excluded.sort_order;


-- ── 4. Remove one listing ───────────────────────────────────────────────────
-- Only takes it out of the carousel — the listing itself is untouched.
delete from collection_products
where product_id = '00000000-0000-0000-0000-000000000000'
  and collection_id = (select id from collections where slug = 'home-carousel');


-- ── 5. Replace the whole carousel in one go (most common) ───────────────────
-- List the IDs in the order you want them shown. Everything else is removed
-- from the carousel. Runs as one transaction: all or nothing.
begin;

delete from collection_products
where collection_id = (select id from collections where slug = 'home-carousel');

insert into collection_products (collection_id, product_id, sort_order)
select c.id, pick.product_id::uuid, pick.position
from collections c
cross join unnest(array[
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
  -- …add up to ~10 (8 show; spares cover any that sell)
]) with ordinality as pick(product_id, position)
where c.slug = 'home-carousel';

commit;


-- ── 6. Hide / show the whole carousel ───────────────────────────────────────
-- update collections set is_active = false where slug = 'home-carousel';  -- hide
-- update collections set is_active = true  where slug = 'home-carousel';  -- show
