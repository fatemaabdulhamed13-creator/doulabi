"use client";

/**
 * Hydrates FavoriteButton state client-side after a cached page load, so the
 * page itself never has to read per-user data. Skips the /api/favorites call
 * entirely for visitors without a Supabase session cookie.
 */

import { useCallback, useEffect, useState, createContext, useContext, ReactNode } from "react";
import { hasSupabaseAuthCookie } from "@/lib/supabase/authCookie";

type FavCtx = {
  favIds: Set<string>;
  loaded: boolean;
  setFavorited: (productId: string, isFav: boolean) => void;
};
const FavContext = createContext<FavCtx>({ favIds: new Set(), loaded: false, setFavorited: () => {} });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cookieNames = document.cookie.split(";").map((c) => c.trim().split("=")[0]);
    if (!hasSupabaseAuthCookie(cookieNames)) return;
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then(({ ids }: { ids: string[] }) => {
        setFavIds(new Set(ids));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const setFavorited = useCallback((productId: string, isFav: boolean) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  return (
    <FavContext.Provider value={{ favIds, loaded, setFavorited }}>
      {children}
    </FavContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavContext);
}
