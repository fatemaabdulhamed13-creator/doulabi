"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type Props = {
  isLoggedIn: boolean;
  initial: string;
  signOut: () => Promise<never>;
};

export default function MobileMenuButton({ isLoggedIn, initial, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
          className="flex items-center gap-2.5 border border-border rounded-full px-3 py-1.5 hover:shadow-md transition-shadow bg-card"
        >
          {open
            ? <X    className="h-4 w-4 text-foreground" />
            : <Menu className="h-4 w-4 text-foreground" />
          }
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">
              {isLoggedIn ? initial : "د"}
            </span>
          </div>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 bg-card rounded-2xl shadow-xl border border-border py-2 z-50">
            {isLoggedIn ? (
              <>
                <div className="px-4 py-2 border-b border-border mb-1">
                  <p className="text-xs text-muted-foreground">حسابي</p>
                </div>
                <Link href="/profile"   onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">الملف الشخصي</Link>
                <Link href="/favorites" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors">المفضلة</Link>
                <Link href="/sell"      onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-semibold text-primary hover:bg-muted transition-colors">بيع ملابسك</Link>
                <div className="border-t border-border my-1" />
                <form action={signOut}>
                  <button type="submit" className="w-full text-right px-4 py-3 text-sm text-red-500 hover:bg-muted transition-colors">
                    تسجيل الخروج
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-border mb-1">
                  <p className="text-xs text-muted-foreground">مرحباً بك في دولابي</p>
                </div>
                <Link href="/login"     onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors">تسجيل الدخول</Link>
                <Link href="/signup"    onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors">إنشاء حساب</Link>
                <div className="border-t border-border my-1" />
                <Link href="/favorites" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors">المفضلة</Link>
                <Link href="/sell"      onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-semibold text-primary hover:bg-muted transition-colors">بيع ملابسك</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Click-away backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
