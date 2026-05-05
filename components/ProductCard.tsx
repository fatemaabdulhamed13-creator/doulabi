"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Heart, ShoppingBag } from "lucide-react";

export interface Product {
  id: string;
  image?: string;
  brand: string;
  title: string;
  size: string;
  condition: "جديد بعلامات" | "ممتاز" | "جيد جداً" | "جيد";
  price: number;
}

const CONDITION_STYLES: Record<Product["condition"], string> = {
  "جديد بعلامات": "bg-emerald-100 text-emerald-800",
  "ممتاز":        "bg-sky-100 text-sky-800",
  "جيد جداً":     "bg-amber-100 text-amber-800",
  "جيد":          "bg-gray-100 text-gray-700",
};

export default function ProductCard({ product }: { product: Product }) {
  const [favorited, setFavorited] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      setFavorited((f) => !f);
    });
  };

  const href = `/products/${product.id}`;

  return (
    <div className="group flex flex-col" dir="rtl">

      {/* ── Image ── */}
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-3 bg-input">
        <Link href={href} className="block w-full h-full">
          {product.image ? (
            <Image
              src={product.image}
              alt={`${product.brand} — ${product.title}`}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-input">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </Link>

        {/* Favorite button — top-right (RTL start of image) */}
        <button
          onClick={handleFavorite}
          disabled={isPending}
          aria-label={favorited ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
          className="
            absolute top-3 right-3
            bg-card/90 hover:bg-card backdrop-blur-sm
            rounded-full p-2 transition-all
            hover:scale-110 disabled:opacity-60
          "
        >
          <Heart
            className={`h-5 w-5 transition-colors duration-200 ${
              favorited
                ? "fill-red-500 text-red-500"
                : "text-foreground hover:text-red-400"
            } ${isPending ? "animate-pulse" : ""}`}
          />
        </button>

        {/* Condition badge — bottom-left */}
        <span
          className={`
            absolute bottom-3 left-3
            text-[10px] font-semibold px-2 py-1 rounded-full
            ${CONDITION_STYLES[product.condition]}
          `}
        >
          {product.condition}
        </span>
      </div>

      {/* ── Info ── */}
      <Link href={href} className="flex flex-col gap-1 flex-1">
        {/* Brand */}
        <p className="text-xs font-bold text-primary uppercase tracking-wide">
          {product.brand}
        </p>

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
          {product.title}
        </h3>

        {/* Price + Size row */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-base font-bold text-foreground">
            {product.price.toLocaleString("ar-LY")}{" "}
            <span className="text-xs font-medium text-muted">د.ل</span>
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-input text-muted font-medium border border-border">
            {product.size}
          </span>
        </div>
      </Link>
    </div>
  );
}
