import { NextRequest, NextResponse } from "next/server";
import { getAuthedRouteClient } from "@/lib/supabase/authedRoute";
import { deleteProductForUser } from "@/lib/products/deleteProduct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This route authenticates via an explicit Authorization: Bearer token, not
// a cookie — so unlike cookie-authenticated endpoints, a permissive origin
// here isn't a CSRF risk (a malicious site can't forge a request it doesn't
// already hold the user's access token for). Needed because a DELETE
// request carrying an Authorization header always triggers a browser CORS
// preflight (OPTIONS) first, and the Expo web build (or any browser client)
// would otherwise be silently blocked before this handler ever runs — the
// native app was never affected since phones don't enforce CORS.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * DELETE /api/delete-product?id=<productId>
 * Permanently deletes one of the caller's own listings, row and R2 images
 * both — same logic the web app's edit form already runs through
 * deleteProductAction, just reachable over HTTP so the mobile app (no
 * Server Actions support) can call it too, authenticated via a Bearer
 * token instead of a session cookie.
 */
export async function DELETE(req: NextRequest) {
  try {
    const authed = await getAuthedRouteClient(req);
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: CORS_HEADERS });
    }

    const productId = req.nextUrl.searchParams.get("id");
    if (!productId) {
      return NextResponse.json({ error: "id is required" }, { status: 400, headers: CORS_HEADERS });
    }

    const result = await deleteProductForUser(authed.client, productId, authed.userId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403, headers: CORS_HEADERS });
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delete-product DELETE] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}
