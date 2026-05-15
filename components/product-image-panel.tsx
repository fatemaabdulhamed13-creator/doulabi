"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const total     = imageUrls.length;
  const activeUrl = imageUrls[activeIdx] ?? null;

  function prev() { setActiveIdx((i) => (i - 1 + total) % total); }
  function next() { setActiveIdx((i) => (i + 1) % total); }

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  /* Keyboard navigation + Escape when lightbox is open */
  useEffect(() => {
    if (!lightboxOpen) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, activeIdx]);

  return (
    <>
      <div className="flex flex-col md:sticky md:top-8">

        {/* ── Main image ───────────────────────────────────────────────── */}
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
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
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

        {/* ── Thumbnail strip ──────────────────────────────────────────── */}
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
                  unoptimized
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxOpen && activeUrl && (
        /* Backdrop — click outside image to close */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            aria-label="إغلاق"
            className="
              absolute top-4 right-4
              w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
              flex items-center justify-center
              text-white transition-colors z-10
            "
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          {total > 1 && (
            <div className="
              absolute top-4 left-1/2 -translate-x-1/2
              bg-white/10 text-white text-xs font-semibold
              px-3 py-1.5 rounded-full pointer-events-none
            ">
              {activeIdx + 1} / {total}
            </div>
          )}

          {/* Prev arrow */}
          {total > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="الصورة السابقة"
              className="
                absolute right-4 top-1/2 -translate-y-1/2
                w-11 h-11 rounded-full bg-white/10 hover:bg-white/25
                flex items-center justify-center text-white
                transition-colors z-10
              "
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Next arrow */}
          {total > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="الصورة التالية"
              className="
                absolute left-4 top-1/2 -translate-y-1/2
                w-11 h-11 rounded-full bg-white/10 hover:bg-white/25
                flex items-center justify-center text-white
                transition-colors z-10
              "
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image — stop propagation so clicking it doesn't close the lightbox */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src={activeUrl}
            alt={`${title} — ${activeIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg select-none"
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
