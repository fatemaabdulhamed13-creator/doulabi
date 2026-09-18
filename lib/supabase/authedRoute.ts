import { NextRequest } from "next/server";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves a Supabase client scoped to the caller's own session, plus their
 * user id, from either a browser session cookie (web app) or an
 * `Authorization: Bearer <access_token>` header (mobile app, which has no
 * cookie jar to rely on) — mirrors the pattern already used in
 * app/api/upload-raw/route.ts, generalized to return a full client (not
 * just the user id) so callers can run RLS-scoped queries, not only auth
 * checks.
 *
 * Every query made with the returned client still goes through RLS as that
 * user — this never elevates to a service role.
 */
export async function getAuthedRouteClient(
  req: NextRequest
): Promise<{ client: SupabaseClient; userId: string } | null> {
  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { client, userId: data.user.id };
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  return { client, userId: user.id };
}
