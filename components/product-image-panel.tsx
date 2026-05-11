"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";

type Props = {
  imageUrls:          string[];
  title:              string;
  productId:          string;
  initialIsFavorited: boolean;
};

export default function ProductImagePanel({ imageUrls, title, productId, initialIsFavorited }: Props) {
  const router = useRouter();
  const [activeIdx, setActiveIdx] = useState(0);

  const total     = imageUrls.length;
  const activeUrl = imageUrls[activeIdx] ?? null;

  function prev() { setActiveIdx((i) => (i - 1 + total) % total); }
  function next() { setActiveIdx((i) => (i + 1) % total); }

  return (
    <div className="flex flex-col md:sticky md:top-8">

      {/* ── Main image ─────────────────────────────────────────────── */}
      <div className="
        relative w-full aspect-[4/5] overflow-hidden bg-muted
        md:aspect-auto md:h-[70vh] md:rounded-2xl
      ">
        {activeUrl && (
          <Image
            src={activeUrl}
            alt={`${title} — ${activeIdx + 1}`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        )}

        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        {/* Back — top right (RTL start) */}
        <button
          onClick={() => router.back()}
          aria-label="رجوع"
          className="
            absolute top-4 right-4
            w-10 h-10 rounded-full
            bg-white/90 backdrop-blur-sm shadow-md
            flex items-center justify-center
            active:scale-95 transition-transform z-10
          "
        >
          <ArrowRight className="h-5 w-5 text-foreground" />
        </button>

        {/* Favourite — top left (RTL end) */}
        <div className="absolute top-4 left-4 z-10">
          <FavoriteButton productId={productId} initialIsFavorited={initialIsFavorited} />
        </div>

        {/* Prev / Next — only when multiple images */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="الصورة السابقة"
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow
                flex items-center justify-center
                active:scale-95 transition-transform z-10
              "
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
            <button
              onClick={next}
              aria-label="الصورة التالية"
              className="
                absolute left-3 top-1/2 -translate-y-1/2
                w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow
                flex items-center justify-center
                active:scale-95 transition-transform z-10
              "
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>

            {/* Counter pill */}
            <div className="
              absolute bottom-3 left-1/2 -translate-x-1/2
              bg-black/60 text-white text-xs font-semibold
              px-2.5 py-1 rounded-full backdrop-blur-sm pointer-events-none
            ">
              {activeIdx + 1} / {total}
            </div>
          </>
        )}
      </div>

      {/* ── Thumbnail strip ────────────────────────────────────────── */}
      {total > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto px-1 pb-1">
          {imageUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              aria-label={`صورة ${i + 1}`}
              className={`
                relative shrink-0 w-16 h-16 rounded-xl overflow-hidden
                ring-2 transition-all duration-200
                ${i === activeIdx
                  ? "ring-primary"
                  : "ring-transparent opacity-55 hover:opacity-100"}
              `}
            >
              <Image
                src={url}
                alt={`صورة ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
