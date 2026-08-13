import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key client with no cookie access — safe to use inside `unstable_cache()`
 * or other cached scopes where Next.js forbids dynamic data sources like
 * `cookies()`/`headers()`. Subject to the same RLS policies as a logged-out
 * visitor, so only use it for queries that are meant to be public.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
