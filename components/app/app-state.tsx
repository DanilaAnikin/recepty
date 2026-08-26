"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { createInitialState, ensureSeedData, type AppState } from "@/lib/domain";
import {
  createStatePersister,
  loadState,
  pruneOrphanImages,
  pushBackup,
  requestPersistentStorage,
} from "@/lib/storage";

/**
 * Jediný zdroj pravdy o stavu aplikace.
 *
 * Původně bylo všechno v ~25 `useState` uvnitř jedné komponenty a každá změna
 * musela projít wrapperem `updateAppState`. Tady je z toho reducer s historií,
 * takže jde nabídnout skutečné Zpět/Znovu (Cmd+Z) a ne jen pětisekundové okno
 * v toastu.
 *
 * Dvě pravidla, na kterých stojí zbytek aplikace:
 * - Každá změna dat prochází `commit()`, které zvýší `revision` a `updatedAt`.
 *   Na tom stojí detekce konfliktů při synchronizaci.
 * - Změny, které nejsou "práce uživatele" (téma, řazení, nastavení syncu),
 *   se do historie nezapisují — jinak by Cmd+Z vracelo přepnutí motivu.
 */

const MAX_HISTORY = 30;

type HistoryEntry = {
  state: AppState;
  label: string;
};

type HistoryState = {
  present: AppState;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Dokud neproběhne načtení z úložiště, nesmí se nic zapisovat zpátky. */
  hydrated: boolean;
};

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "commit"; updater: (current: AppState) => AppState; label: string; track: boolean }
  | { type: "undo" }
  | { type: "redo" };

function bumpRevision(state: AppState): AppState {
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

function reducer(historyState: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "hydrate":
      return { present: action.state, past: [], future: [], hydrated: true };

    case "commit": {
      const nextPresent = bumpRevision(ensureSeedData(action.updater(historyState.present)));

      if (!action.track) {
        return { ...historyState, present: nextPresent };
      }

      return {
        ...historyState,
        present: nextPresent,
        past: [
          ...historyState.past.slice(-(MAX_HISTORY - 1)),
          { state: historyState.present, label: action.label },
        ],
        // Nová akce po Zpět zahazuje větev Znovu — stejně jako v každém editoru.
        future: [],
      };
    }

    case "undo": {
      const previous = historyState.past.at(-1);
      if (!previous) {
        return historyState;
      }
      return {
        ...historyState,
        present: bumpRevision(previous.state),
        past: historyState.past.slice(0, -1),
        future: [{ state: historyState.present, label: previous.label }, ...historyState.future],
      };
    }

    case "redo": {
      const next = historyState.future[0];
      if (!next) {
        return historyState;
      }
      return {
        ...historyState,
        present: bumpRevision(next.state),
        past: [...historyState.past, { state: historyState.present, label: next.label }],
        future: historyState.future.slice(1),
      };
    }

    default:
      return historyState;
  }
}

export type CommitOptions = {
  /** Zapsat do historie Zpět/Znovu. Výchozí `true`. */
  track?: boolean;
};

export type AppStateContextValue = {
  state: AppState;
  hydrated: boolean;
  commit: (
    updater: (current: AppState) => AppState,
    label: string,
    options?: CommitOptions,
  ) => void;
  /** Nahradí celý stav (import zálohy, stažení ze serveru, obnova snapshotu). */
  replaceState: (state: AppState, label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  /** Chyba zápisu do úložiště (typicky vyčerpaná kvóta). */
  storageError: unknown;
  clearStorageError: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

/** Jak často se ukládá automatický snapshot pro případ poškození dat. */
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Výchozí stav se staví línou inicializací — naseedovat 300 ingrediencí
  // při každém renderu by bylo zbytečné. Skutečná data přijdou z `loadState`.
  const [historyState, dispatch] = useReducer(reducer, undefined, () => ({
    present: createInitialState(),
    past: [],
    future: [],
    hydrated: false,
  }));

  const storageErrorRef = useRef<unknown>(null);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  const persister = useMemo(
    () =>
      createStatePersister(400, (error) => {
        storageErrorRef.current = error;
        forceRender();
      }),
    [],
  );

  // Načtení uložených dat. Běží jednou; do té doby se nic nezapisuje, aby
  // prázdný počáteční stav nepřepsal to, co je v databázi.
  useEffect(() => {
    let cancelled = false;

    void loadState().then((loaded) => {
      if (cancelled) {
        return;
      }
      dispatch({ type: "hydrate", state: loaded });
      void requestPersistentStorage();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Perzistence změn.
  useEffect(() => {
    if (!historyState.hydrated) {
      return;
    }
    persister.schedule(historyState.present);
  }, [historyState.hydrated, historyState.present, persister]);

  // Zavření záložky nesmí zahodit posledních 400 ms práce.
  useEffect(() => {
    const flush = () => {
      void persister.flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, [persister]);

  // Denní snapshot + úklid fotek, na které už se nikdo neodkazuje.
  useEffect(() => {
    if (!historyState.hydrated) {
      return;
    }
    const timer = setTimeout(() => {
      void pushBackup(historyState.present);
      void pruneOrphanImages(historyState.present);
    }, 4000);
    return () => clearTimeout(timer);
    // Schválně jen při hydrataci — ne při každé změně stavu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyState.hydrated]);

  useEffect(() => {
    if (!historyState.hydrated) {
      return;
    }
    const interval = setInterval(() => {
      void pushBackup(historyState.present);
    }, BACKUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [historyState.hydrated, historyState.present]);

  const commit = useCallback<AppStateContextValue["commit"]>((updater, label, options) => {
    dispatch({ type: "commit", updater, label, track: options?.track !== false });
  }, []);

  const replaceState = useCallback<AppStateContextValue["replaceState"]>((state, label) => {
    dispatch({ type: "commit", updater: () => state, label, track: true });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  // Cmd/Ctrl+Z a Cmd/Ctrl+Shift+Z. Uvnitř polí se klávesa nechává prohlížeči,
  // aby fungovalo běžné Zpět v rozepsaném textu.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      state: historyState.present,
      hydrated: historyState.hydrated,
      commit,
      replaceState,
      undo,
      redo,
      canUndo: historyState.past.length > 0,
      canRedo: historyState.future.length > 0,
      undoLabel: historyState.past.at(-1)?.label ?? null,
      redoLabel: historyState.future[0]?.label ?? null,
      storageError: storageErrorRef.current,
      clearStorageError: () => {
        storageErrorRef.current = null;
        forceRender();
      },
    }),
    [historyState, commit, replaceState, undo, redo],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState musí být uvnitř <AppStateProvider>.");
  }
  return context;
}
