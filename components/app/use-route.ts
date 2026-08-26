"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Navigace přes parametry URL.
 *
 * Do téhle chvíle žilo všechno v React stavu: recept neměl adresu, nešel poslat
 * odkazem ani uložit do záložek — a hlavně, systémové tlačítko Zpět na Androidu
 * zavíralo celou aplikaci místo otevřeného detailu.
 *
 * Používají se parametry dotazu (`/?tab=recepty&recept=12`), ne cesty. Cesta
 * zůstává `/`, takže obnovení stránky funguje i bez serverového routování
 * a bez rizika 404 v režimu `output: standalone`.
 *
 * URL se čte přes `useSyncExternalStore`, protože je to externí zdroj pravdy
 * mimo React. Kopírovat ji do `useState` v efektu by znamenalo render navíc
 * a riziko, že se stav s adresou rozejde.
 */

export const APP_TABS = ["recipes", "ingredients", "shopping", "planner"] as const;
export type AppTab = (typeof APP_TABS)[number];

/** Hodnoty v URL jsou česky, ať je odkaz čitelný. */
const TAB_TO_PARAM: Record<AppTab, string> = {
  recipes: "recepty",
  ingredients: "ingredience",
  shopping: "nakup",
  planner: "plan",
};

const PARAM_TO_TAB = new Map<string, AppTab>(
  (Object.entries(TAB_TO_PARAM) as Array<[AppTab, string]>).map(([tab, param]) => [param, tab]),
);

export type Route = {
  tab: AppTab;
  /** Otevřený detail receptu. */
  recipeId: number | null;
  /** Běží režim vaření. */
  cooking: boolean;
};

const DEFAULT_ROUTE: Route = { tab: "recipes", recipeId: null, cooking: false };

// ---------------------------------------------------------------------------
// Externí zdroj: adresa v prohlížeči
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();

/** `pushState` sám žádnou událost nevyvolá — musíme si posluchače zavolat sami. */
function notifyLocationChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToLocation(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

function getSearchSnapshot(): string {
  return window.location.search;
}

/** Na serveru žádná adresa není — první render musí odpovídat výchozí trase. */
function getServerSearchSnapshot(): string {
  return "";
}

export function parseSearch(search: string): Route {
  const params = new URLSearchParams(search);

  const tabParam = params.get("tab") ?? "";
  const tab = PARAM_TO_TAB.get(tabParam) ?? DEFAULT_ROUTE.tab;

  const recipeParam = params.get("recept");
  const parsedRecipeId = recipeParam === null ? Number.NaN : Number.parseInt(recipeParam, 10);
  const recipeId = Number.isFinite(parsedRecipeId) ? parsedRecipeId : null;

  return {
    tab,
    recipeId,
    // Vaření bez otevřeného receptu nedává smysl — takovou adresu ignorujeme.
    cooking: recipeId !== null && params.get("varime") === "1",
  };
}

export function routeToSearch(route: Route): string {
  const params = new URLSearchParams();

  if (route.tab !== DEFAULT_ROUTE.tab) {
    params.set("tab", TAB_TO_PARAM[route.tab]);
  }
  if (route.recipeId !== null) {
    params.set("recept", `${route.recipeId}`);
    if (route.cooking) {
      params.set("varime", "1");
    }
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export type NavigateOptions = {
  /** Nahradit aktuální položku historie místo přidání nové. */
  replace?: boolean;
};

export function useRoute() {
  const search = useSyncExternalStore(
    subscribeToLocation,
    getSearchSnapshot,
    getServerSearchSnapshot,
  );

  const route = useMemo(() => parseSearch(search), [search]);

  const navigate = useCallback(
    (patch: Partial<Route>, options: NavigateOptions = {}) => {
      const next: Route = { ...parseSearch(window.location.search), ...patch };
      const url = `${window.location.pathname}${routeToSearch(next)}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (options.replace) {
        window.history.replaceState(null, "", url);
      } else if (url !== currentUrl) {
        window.history.pushState(null, "", url);
      } else {
        // Stejná adresa — není co oznamovat ani do čeho přidávat historii.
        return;
      }

      notifyLocationChanged();
    },
    [],
  );

  /** Krok zpět v historii — používá se pro zavírání detailu. */
  const back = useCallback(() => {
    window.history.back();
  }, []);

  return { route, navigate, back };
}

/** Absolutní odkaz na recept — pro sdílení. */
export function recipeShareUrl(recipeId: number): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.origin}${window.location.pathname}?recept=${recipeId}`;
}
