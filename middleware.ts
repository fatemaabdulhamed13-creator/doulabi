import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "@/lib/supabase/authCookie";

export async function middleware(request: NextRequest) {
  // Anonymous visitors (most viral/social traffic) have no session to refresh.
  if (!hasSupabaseAuthCookie(request.cookies.getAll().map((c) => c.name))) {
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
