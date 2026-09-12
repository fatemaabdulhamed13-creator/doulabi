"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Search, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/actions/auth";
import MobileMenuButton from "./mobile-menu-button";

/**
 * Renders a static shell (no server-side cookies()/getUser() call), then
 * hydrates auth state client-side after mount — same pattern as
 * FavoritesProvider. This keeps Navbar (part of every route's layout) from
 * forcing the whole page into dynamic SSR just to know who's logged in.
 */
export default function Navbar() {
  const [authState, setAuthState] = useState<{
    loaded: boolean;
    isLoggedIn: boolean;
    initial: string;
  }>({ loaded: false, isLoggedIn: false, initial: "" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let profile: { full_name: string } | null = null;
        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          profile = data;
        }

        if (cancelled) return;
        setAuthState({
          loaded: true,
          isLoggedIn: !!user && !!profile,
          initial: profile?.full_name.charAt(0) ?? "",
        });
      } catch {
        if (cancelled) return;
        setAuthState({ loaded: true, isLoggedIn: false, initial: "" }); // unauthenticated or network error
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { loaded, isLoggedIn, initial } = authState;

  const iconBtn = "w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-muted text-foreground";

  return (
    <nav dir="rtl" className="sticky top-0 z-50 bg-card border-b border-border w-full">

      {/* ════════════════════════════════════════════════════════════
          MOBILE  (< md): hamburger | logo | search icon
          ════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex items-center justify-between h-14 px-4">

        {/* Hamburger + dropdown — client island. Its badge is a fixed-size
            circle regardless of auth state, so hydration never shifts it. */}
        <MobileMenuButton
          isLoggedIn={isLoggedIn}
          initial={initial}
          signOut={signOutAction}
        />

        {/* Logo — center */}
        <Link href="/" aria-label="دولابي - الصفحة الرئيسية">
          <Image src="/logo.svg" alt="دولابي" width={120} height={48} className="object-contain w-auto h-10 md:h-14" />
        </Link>

        {/* Search icon — RTL end (left) */}
        <Link href="/search" aria-label="البحث" className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
          <Search className="h-5 w-5 text-foreground" />
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════
          DESKTOP (>= md): logo | search bar | action buttons
          ════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex items-center h-16 px-8 gap-5">

        {/* Logo — RTL start (right) */}
        <Link href="/" aria-label="دولابي - الصفحة الرئيسية" className="shrink-0">
          <Image src="/logo.svg" alt="دولابي" width={140} height={56} className="object-contain w-auto h-10 md:h-14" />
        </Link>

        {/* Search bar — fills remaining space */}
        <form action="/search" method="GET" className="flex-1">
          <label className="
            flex items-center gap-3
            rounded-full border border-foreground/20 bg-muted
            px-5 py-2.5
            cursor-text
            focus-within:border-primary focus-within:bg-card
            transition-colors
          ">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              name="q"
              dir="rtl"
              placeholder="ابحث في دولابي..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </label>
        </form>

        {/* Actions — RTL end (left) */}
        <div className="shrink-0 flex items-center gap-2">

          {/* Sell CTA */}
          <Link
            href="/sell"
            className="
              px-5 py-2 rounded-full
              bg-primary text-white font-bold text-sm
              hover:brightness-110 active:scale-[0.98]
              transition-all shadow-sm
            "
          >
            + بيع
          </Link>

          {/* Favorites */}
          <Link href="/favorites" aria-label="المفضلة" className={iconBtn}>
            <Heart className="h-5 w-5" />
          </Link>

          {/* Auth slot — fixed width reserves room for the widest resolved
              state (avatar + sign-out button) so neither the pending→resolved
              transition nor a logged-in↔logged-out swap ever reflows the bar. */}
          <div className="w-56 flex items-center justify-end gap-2">
            {!loaded ? (
              /* Skeleton placeholder while the client-side auth fetch is pending */
              <div
                aria-hidden="true"
                className="w-9 h-9 rounded-full bg-muted animate-pulse"
              />
            ) : isLoggedIn ? (
              <>
                {/* Avatar — links to profile */}
                <Link
                  href="/profile"
                  aria-label="حسابي"
                  className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <span className="text-sm font-bold text-primary">{initial}</span>
                </Link>

                {/* Sign out */}
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="
                      px-4 py-2 rounded-full
                      border border-border
                      text-sm font-medium text-foreground
                      hover:bg-muted transition-colors
                    "
                  >
                    تسجيل الخروج
                  </button>
                </form>
              </>
            ) : (
              /* Generic profile icon when logged out */
              <Link href="/profile" aria-label="حسابي" className={iconBtn}>
                <User className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
