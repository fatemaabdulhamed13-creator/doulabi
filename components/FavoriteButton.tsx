"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/favorite";

type Props = {
  productId:          string;
  initialIsFavorited: boolean;
};

export default function FavoriteButton({ productId, initialIsFavorited }: Props) {
  const [isFav, setOptimisticFav] = useOptimistic(
    initialIsFavorited,
    (_: boolean, next: boolean) => next
  );
  const [, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimisticFav(!isFav);
      await toggleFavoriteAction(productId);
    });
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isFav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      className="
        w-10 h-10 rounded-full
        bg-white/90 backdrop-blur-sm shadow-md
        flex items-center justify-center
        active:scale-95 transition-transform
      "
    >
      <Heart
        className={`h-5 w-5 transition-colors duration-200 ${
          isFav ? "fill-red-500 text-red-500" : "text-foreground"
        }`}
      />
    </button>
  );
}
