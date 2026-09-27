"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavoriteAction } from "@/app/actions/favorite";
import { useFavorites } from "@/components/FavoritesProvider";

type Props = {
  productId: string;
  /** Used until a FavoritesProvider has loaded, or when there is none (e.g. /favorites). */
  initialIsFavorited?: boolean;
};

export default function FavoriteButton({ productId, initialIsFavorited = false }: Props) {
  const { favIds, loaded, setFavorited } = useFavorites();
  const serverValue = loaded ? favIds.has(productId) : initialIsFavorited;

  const [isFav, setOptimisticFav] = useOptimistic(
    serverValue,
    (_: boolean, next: boolean) => next
  );
  const [, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFav;
    startTransition(async () => {
      setOptimisticFav(next);
      await toggleFavoriteAction(productId);
      setFavorited(productId, next);
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
