"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export default function MobileSearchBar() {
  const router     = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q      = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else   params.delete("q");
    router.push("/search?" + params.toString());
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full mb-4 block md:hidden" dir="rtl">
      <input
        type="text"
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="ابحث عن ماركة، ستايل، أو اسم..."
        className="w-full bg-gray-100 rounded-full py-3 pr-12 pl-4 text-sm text-foreground placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-primary/40 transition-all"
      />
      <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </form>
  );
}
