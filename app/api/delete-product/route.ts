import { NextRequest, NextResponse } from "next/server";
import { getAuthedRouteClient } from "@/lib/supabase/authedRoute";
import { deleteProductForUser } from "@/lib/products/deleteProduct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productId = req.nextUrl.searchParams.get("id");
    if (!productId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await deleteProductForUser(authed.client, productId, authed.userId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[delete-product DELETE] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
