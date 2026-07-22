"use client";

/**
 * Hydrates FavoriteButton state client-side after a static page load.
 * Fetches /api/favorites once per mount, then passes the user's favorited
 * product IDs down so each FavoriteButton can show the correct filled/empty state.
 *
 * This keeps app/page.tsx fully static (0 invocations) while still giving
 * logged-in users accurate heart icons.
 */

import { useEffect, useState, createContext, useContext, ReactNode } from "react";

type FavCtx = { favIds: Set<string>; loaded: boolean };
const FavContext = createContext<FavCtx>({ favIds: new Set(), loaded: false });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then(({ ids }: { ids: string[] }) => {
        setFavIds(new Set(ids));
        setLoaded(true);
      })
      .catch(() => setLoaded(true)); // unauthenticated or network error — leave empty
  }, []);

  return (
    <FavContext.Provider value={{ favIds, loaded }}>
      {children}
    </FavContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavContext);
}
