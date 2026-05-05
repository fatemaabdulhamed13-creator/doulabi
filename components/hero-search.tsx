"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4" dir="rtl">

      {/* ── Mobile: stacked input + button ── */}
      <form
        onSubmit={handleSubmit}
        className="md:hidden flex flex-col gap-3"
      >
        <div className="flex items-center bg-card rounded-2xl shadow-[0_8px_32px_rgba(28,16,8,0.18)] overflow-hidden border border-border/60">
          <Search className="h-5 w-5 text-muted mx-4 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن ملابس، ماركات، مقاسات..."
            className="
              flex-1 py-4 pr-1 pl-4 text-base bg-transparent outline-none
              text-foreground placeholder:text-muted-foreground
            "
            dir="rtl"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="
            w-full py-3.5 rounded-2xl bg-primary hover:bg-primary-hover
            text-accent-foreground font-semibold text-base
            transition-colors shadow-md
          "
        >
          ابحث الآن
        </button>
      </form>

      {/* ── Desktop: pill-shaped combined search bar ── */}
      <form
        onSubmit={handleSubmit}
        className="
          hidden md:flex items-center
          bg-card rounded-full shadow-[0_16px_48px_rgba(28,16,8,0.22)]
          border border-border/60 overflow-hidden
          hover:shadow-[0_20px_56px_rgba(28,16,8,0.28)] transition-shadow group
        "
      >
        <div className="flex-1 flex items-center px-6">
          <div className="text-right flex-1">
            <p className="text-xs font-semibold text-foreground mb-0.5">ابحث في دولابي</p>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ماركات، مقاسات، قطع معينة..."
              className="
                w-full text-sm bg-transparent outline-none
                text-foreground placeholder:text-muted-foreground
              "
              dir="rtl"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="h-10 w-px bg-border mx-2 shrink-0" />

        <div className="px-6 text-right">
          <p className="text-xs font-semibold text-foreground mb-0.5">الفئة</p>
          <p className="text-sm text-muted-foreground">الكل</p>
        </div>

        <button
          type="submit"
          className="
            m-2 bg-primary hover:bg-primary-hover
            text-accent-foreground p-4 rounded-full
            group-hover:scale-105 transition-all shadow-sm
          "
          aria-label="بحث"
        >
          <Search className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
