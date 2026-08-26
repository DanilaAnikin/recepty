"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Sleduje media query.
 *
 * `useSyncExternalStore` je tu na místě — `matchMedia` je externí zdroj pravdy
 * a kopírovat ho do `useState` v efektu znamená render navíc a okno, ve kterém
 * se stav s realitou rozchází.
 *
 * Serverový snapshot je vždycky `false`, protože server preference prohlížeče
 * nezná; skutečná hodnota se doplní hned po hydrataci. FOUC to nezpůsobí —
 * motiv nastavuje bootstrap script v `layout.tsx` ještě před hydratací.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function usePrefersDark(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}
