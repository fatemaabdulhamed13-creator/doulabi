import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/favorites
 * Returns the authenticated user's favorited product IDs.
 * Unauthenticated requests return an empty list (no error).
 *
 * Called once client-side after a static page loads so the page itself
 * can be fully statically cached (0 serverless invocations per visit).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ids: [] });
  }

  const { data } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", user.id);

  const ids = (data ?? []).map((r) => r.product_id as string);
  return NextResponse.json({ ids });
}
