import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// @supabase/ssr names the session cookie `sb-<project-ref>-auth-token`
// (large tokens get chunked into `-auth-token.0`, `-auth-token.1`, ...).
// Derive the ref from the project URL instead of hardcoding it so this
// still works if the project ever changes.
const SUPABASE_PROJECT_REF = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  } catch {
    return undefined;
  }
})();

/**
 * Anonymous visitors — the vast majority of viral/social traffic — never
 * send a Supabase session cookie. Skip the getUser() refresh (a JWT verify
 * plus, when the token is stale, a network round-trip to Supabase Auth) for
 * them entirely instead of paying that cost on every single page view.
 * Fails open (treats the request as authenticated) if the ref can't be
 * determined, so we never skip a refresh a logged-in user actually needs.
 */
function hasAuthCookie(request: NextRequest): boolean {
  if (!SUPABASE_PROJECT_REF) return true;
  const prefix = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  return request.cookies.getAll().some((c) => c.name.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  if (!hasAuthCookie(request)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — do not add logic between createServerClient and getUser
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static assets (as before), plus purely-public static routes that
    // never depend on auth state: the PWA manifest/service worker, and the
    // static legal pages.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|terms|privacy|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
