"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, Home, Search, Plus, Heart, User } from "lucide-react";

/* ── Nav item helper ─────────────────────────────────────────────────────── */

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-end gap-1 px-4 py-1 group"
    >
      <Icon
        className={`h-[22px] w-[22px] transition-colors duration-150 ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
        strokeWidth={active ? 2.5 : 1.75}
      />
      <span
        className={`text-[10px] font-semibold tracking-tight transition-colors duration-150 ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

/* ── Bottom Nav ──────────────────────────────────────────────────────────── */

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      dir="rtl"
      className="
        fixed bottom-0 left-0 right-0 z-50
        bg-card border-t border-border
        shadow-[0_-4px_24px_rgba(0,0,0,0.07)]
        md:hidden
      "
    >
      <div
        className="flex items-end justify-around max-w-lg mx-auto px-1 pt-2"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* الرئيسية — Home */}
        <NavItem href="/"          icon={Home}   label="الرئيسية" active={pathname === "/"} />

        {/* البحث — Search */}
        <NavItem href="/search"    icon={Search} label="البحث"    active={pathname === "/search"} />

        {/* ── FAB: بيع (Sell) — Center Centerpiece ───────────────────── */}
        <div className="flex flex-col items-center -mt-5">
          <Link
            href="/sell"
            aria-label="بيع"
            className="
              flex items-center justify-center
              w-14 h-14 rounded-full
              bg-primary
              shadow-[0_6px_24px_rgba(93,42,66,0.50)]
              active:scale-95 hover:brightness-110
              transition-all duration-150
              mb-1
            "
          >
            <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
          </Link>
          <span className="text-[10px] font-bold text-primary tracking-tight">بيع</span>
        </div>

        {/* المفضلة — Favorites */}
        <NavItem href="/favorites" icon={Heart}  label="المفضلة"  active={pathname === "/favorites"} />

        {/* حسابي — Profile */}
        <NavItem href="/profile"   icon={User}   label="حسابي"    active={pathname === "/profile"} />
      </div>
    </nav>
  );
}
