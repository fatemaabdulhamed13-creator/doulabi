"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import FavoriteButton from "@/components/FavoriteButton";

type Props = {
  imageUrl:           string | null;
  title:              string;
  productId:          string;
  initialIsFavorited: boolean;
};

export default function ProductImagePanel({ imageUrl, title, productId, initialIsFavorited }: Props) {
  const router = useRouter();

  return (
    <div className="
      relative w-full aspect-[4/5] overflow-hidden bg-muted
      md:aspect-auto md:h-[80vh] md:rounded-2xl md:sticky md:top-8
    ">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={title}
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
          active:scale-95 transition-transform
        "
      >
        <ArrowRight className="h-5 w-5 text-foreground" />
      </button>

      {/* Favourite — top left (RTL end) */}
      <div className="absolute top-4 left-4">
        <FavoriteButton productId={productId} initialIsFavorited={initialIsFavorited} />
      </div>
    </div>
  );
}
