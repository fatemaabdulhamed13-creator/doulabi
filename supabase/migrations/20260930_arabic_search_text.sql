-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Arabic-normalized free-text search
--
-- Free-text search used a raw ILIKE on title/description, so spelling
-- variants that Arabic speakers treat as the same word never matched:
--   احمر ≠ أحمر (hamza forms)      شنطه ≠ شنطة (ta marbuta)
--   كرسى ≠ كرسي (alef maqsura)     any tashkeel / tatweel difference
-- and brand was not searched at all ("زارا" missed Zara items whose title
-- doesn't repeat the brand).
--
-- This adds a stored, generated `search_text` column — title + brand +
-- description, lowercased and normalized by public.normalize_ar() — with a
-- trigram index. The mobile app (lib/arabicSearch.ts) normalizes the typed
-- query with the exact same rules and ILIKEs each word against this column.
-- Keep the two in sync if either changes.
--
-- Safe to apply before or after the app update ships: the app falls back to
-- the old title/description query if this column doesn't exist yet.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

create or replace function public.normalize_ar(t text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(
    -- Strip tashkeel (U+064B–U+065F), superscript alef (U+0670) and
    -- tatweel (U+0640) first, then fold letter variants below.
    regexp_replace(lower(coalesce(t, '')), '[ً-ٰٟـ]', '', 'g'),
    'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩',
    'اااايهوي0123456789'
  )
$$;

alter table public.products
  add column if not exists search_text text
  generated always as (
    public.normalize_ar(
      coalesce(title, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description, '')
    )
  ) stored;

create index if not exists idx_products_search_text_trgm
  on public.products using gin (search_text gin_trgm_ops);
