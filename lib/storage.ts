"use client";

import {
  BACKUP_KEY,
  STORAGE_KEY,
  createInitialState,
  normalizeState,
  parseStoredState,
  type AppState,
} from "./domain";

/**
 * Perzistence stavu v IndexedDB.
 *
 * Proč ne localStorage: celý stav byl jeden JSON string pod jedním klíčem a
 * fotky v něm ležely jako base64 data URL. Base64 je o třetinu větší než
 * binárka, každý zápis serializoval úplně všechno a limit ~5 MB se dal
 * vyčerpat pár desítkami receptů s fotkou.
 *
 * IndexedDB tohle řeší třemi věcmi:
 * - stav se ukládá strukturovaným klonem, ne přes `JSON.stringify`,
 * - fotky žijí ve vlastním store jako `Blob` (žádné base64),
 * - kvóta je řádově vyšší a dá se navíc požádat o `persist()`.
 *
 * Když IndexedDB není k dispozici (privátní režim některých prohlížečů),
 * vrstva tiše spadne zpátky na localStorage, aby appka pořád fungovala.
 */

const DB_NAME = "recepty-terinky";
const DB_VERSION = 1;
const STORE_STATE = "state";
const STORE_IMAGES = "images";
const STORE_BACKUPS = "backups";
const STATE_KEY = "current";

/** Kolik automatických snapshotů se drží pro případ, že se data pokazí. */
export const MAX_BACKUPS = 5;

export type StoredBackup = {
  id: number;
  createdAt: string;
  state: AppState;
};

export type StorageKind = "indexeddb" | "localstorage" | "memory";

let databasePromise: Promise<IDBDatabase | null> | null = null;
let resolvedKind: StorageKind = "memory";

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) {
    return databasePromise;
  }

  if (!isIndexedDbAvailable()) {
    databasePromise = Promise.resolve(null);
    return databasePromise;
  }

  databasePromise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      console.error("Recepty Terinky: IndexedDB.open selhalo", error);
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
      }
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        db.createObjectStore(STORE_BACKUPS, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Prohlížeč může databázi zavřít při upgrade v jiném tabu — pak se
      // příště otevře znovu místo tichého selhávání všech operací.
      db.onclose = () => {
        databasePromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      console.error("Recepty Terinky: IndexedDB není dostupná", request.error);
      resolve(null);
    };

    request.onblocked = () => {
      console.warn("Recepty Terinky: IndexedDB je blokovaná jiným tabem");
      resolve(null);
    };
  });

  return databasePromise;
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then((db) => {
    if (!db) {
      return Promise.reject(new Error("IndexedDB není dostupná."));
    }
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.onabort = () => reject(transaction.error ?? new Error("Transakce přerušena."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Transakce selhala."));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Požadavek selhal."));
    });
  });
}

/** Které úložiště se reálně používá — pro diagnostiku v nastavení. */
export function storageKind(): StorageKind {
  return resolvedKind;
}

/**
 * Požádá prohlížeč o trvalé úložiště, aby data nepadla za oběť automatickému
 * úklidu. Je to best-effort — Safari a Firefox to řeší po svém a odmítnutí
 * nic nerozbíjí.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    if (await navigator.storage.persisted()) {
      return true;
    }
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Kolik místa data zabírají a kolik ho ještě je (pokud to prohlížeč prozradí). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stav
// ---------------------------------------------------------------------------

/**
 * Načte stav. Pořadí zdrojů:
 * 1. IndexedDB (aktuální úložiště),
 * 2. localStorage (data z předchozích verzí aplikace — jednorázově se přenesou),
 * 3. čerstvý naseedovaný stav.
 */
export async function loadState(): Promise<AppState> {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const stored = await runTransaction<unknown>(STORE_STATE, "readonly", (store) =>
      store.get(STATE_KEY),
    );
    resolvedKind = "indexeddb";

    if (stored !== undefined && stored !== null) {
      return normalizeState(stored);
    }

    // Prázdná IndexedDB + data v localStorage = upgrade z předchozí verze.
    const legacy = window.localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const migrated = parseStoredState(legacy);
      await saveStateNow(migrated);
      // localStorage schválně nemažeme hned — kdyby migrace dopadla špatně,
      // uživatel o data nepřijde. Úklid řeší `clearLegacyStorage()`.
      return migrated;
    }

    const fresh = createInitialState();
    await saveStateNow(fresh);
    return fresh;
  } catch (error) {
    console.error("Recepty Terinky: čtení z IndexedDB selhalo, používám localStorage", error);
    resolvedKind = "localstorage";
    return parseStoredState(window.localStorage.getItem(STORAGE_KEY));
  }
}

/** Okamžitý zápis stavu (bez debounce). */
export async function saveStateNow(state: AppState): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await runTransaction(STORE_STATE, "readwrite", (store) =>
      // Strukturovaný klon zvládne i Date/Blob a je rychlejší než JSON.
      store.put(structuredCloneSafe(state), STATE_KEY),
    );
    resolvedKind = "indexeddb";
  } catch (error) {
    console.error("Recepty Terinky: zápis do IndexedDB selhal, zkouším localStorage", error);
    resolvedKind = "localstorage";
    // Fallback musí projít i tehdy, když jsou ve stavu staré data URL fotek —
    // proto se případná QuotaExceededError propaguje volajícímu, který na ni
    // umí uživateli ukázat srozumitelný toast.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

/**
 * IndexedDB neumí uložit objekt, který obsahuje funkce nebo proxy.
 * Stav je čistá data, ale projít ho klonem je levná pojistka proti tomu, aby
 * do něj React nebo devtools nepodstrčily něco neklonovatelného.
 */
function structuredCloneSafe(state: AppState): AppState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as AppState;
}

export type StatePersister = {
  /** Naplánuje zápis; opakovaná volání v okně `delayMs` se slijí do jednoho. */
  schedule: (state: AppState) => void;
  /** Zapíše okamžitě, co je naplánované (např. při zavření záložky). */
  flush: () => Promise<void>;
  cancel: () => void;
};

/**
 * Debouncovaný zapisovač. Bez něj se celý stav ukládal při každé změně —
 * u psaní do formuláře to znamenalo desítky zápisů za sekundu.
 */
export function createStatePersister(
  delayMs = 400,
  onError?: (error: unknown) => void,
): StatePersister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: AppState | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  const write = async () => {
    const state = pending;
    pending = null;
    if (!state) {
      return;
    }
    try {
      await saveStateNow(state);
    } catch (error) {
      onError?.(error);
    }
  };

  return {
    schedule(state) {
      pending = state;
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        inFlight = inFlight.then(write);
      }, delayMs);
    },
    async flush() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      inFlight = inFlight.then(write);
      await inFlight;
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
}

/** Smaže stará data z localStorage po ověřené migraci. */
export function clearLegacyStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    // Nevadí — je to jen úklid.
  }
}

// ---------------------------------------------------------------------------
// Fotky
// ---------------------------------------------------------------------------

const objectUrlCache = new Map<string, string>();

function createImageKey(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `img_${random}`;
}

/** Uloží fotku jako Blob a vrátí klíč, kterým se na ni recept odkazuje. */
export async function putImage(blob: Blob): Promise<string> {
  const key = createImageKey();
  await runTransaction(STORE_IMAGES, "readwrite", (store) => store.put(blob, key));
  return key;
}

export async function getImageBlob(key: string): Promise<Blob | null> {
  try {
    const value = await runTransaction<unknown>(STORE_IMAGES, "readonly", (store) => store.get(key));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

/**
 * URL fotky pro `<img src>`. Object URL se cachuje podle klíče, takže
 * překreslení komponenty nevyrobí pokaždé nový a nenechá za sebou svinčík.
 */
export async function getImageUrl(key: string): Promise<string | null> {
  const cached = objectUrlCache.get(key);
  if (cached) {
    return cached;
  }
  const blob = await getImageBlob(key);
  if (!blob) {
    return null;
  }
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(key, url);
  return url;
}

export async function deleteImage(key: string): Promise<void> {
  const cached = objectUrlCache.get(key);
  if (cached) {
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(key);
  }
  try {
    await runTransaction(STORE_IMAGES, "readwrite", (store) => store.delete(key));
  } catch (error) {
    console.error("Recepty Terinky: smazání fotky selhalo", error);
  }
}

/** Uvolní všechny object URL — volat při odmountování aplikace. */
export function revokeAllImageUrls(): void {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrlCache.clear();
}

/**
 * Smaže fotky, na které se už žádný recept neodkazuje.
 * Bez tohohle by se v databázi hromadily fotky smazaných receptů.
 */
export async function pruneOrphanImages(state: AppState): Promise<number> {
  try {
    const referenced = new Set<string>();
    for (const recipe of state.recipes) {
      for (const key of recipe.imageKeys ?? []) {
        referenced.add(key);
      }
    }

    const allKeys = await runTransaction<IDBValidKey[]>(STORE_IMAGES, "readonly", (store) =>
      store.getAllKeys(),
    );

    const orphans = allKeys
      .map((key) => `${key}`)
      .filter((key) => !referenced.has(key));

    for (const key of orphans) {
      await deleteImage(key);
    }
    return orphans.length;
  } catch (error) {
    console.error("Recepty Terinky: úklid osiřelých fotek selhal", error);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Zálohy
// ---------------------------------------------------------------------------

/**
 * Uloží snapshot stavu a nechá jen posledních `MAX_BACKUPS`.
 * Slouží k rychlému návratu, když se data pokazí — plnohodnotná záloha je
 * pořád export do souboru, protože ta přežije i smazání dat prohlížeče.
 */
export async function pushBackup(state: AppState): Promise<void> {
  try {
    await runTransaction(STORE_BACKUPS, "readwrite", (store) =>
      store.add({ createdAt: new Date().toISOString(), state: structuredCloneSafe(state) }),
    );

    const all = await listBackups();
    const excess = all.slice(MAX_BACKUPS);
    for (const backup of excess) {
      await runTransaction(STORE_BACKUPS, "readwrite", (store) => store.delete(backup.id));
    }
  } catch (error) {
    console.error("Recepty Terinky: automatická záloha selhala", error);
  }
}

/** Snapshoty od nejnovějšího. */
export async function listBackups(): Promise<StoredBackup[]> {
  try {
    const all = await runTransaction<StoredBackup[]>(STORE_BACKUPS, "readonly", (store) =>
      store.getAll(),
    );
    return all.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch {
    return [];
  }
}

export async function restoreBackup(id: number): Promise<AppState | null> {
  try {
    const backup = await runTransaction<StoredBackup | undefined>(STORE_BACKUPS, "readonly", (store) =>
      store.get(id),
    );
    if (!backup) {
      return null;
    }
    return normalizeState(backup.state);
  } catch (error) {
    console.error("Recepty Terinky: obnova zálohy selhala", error);
    return null;
  }
}

/** Smaže úplně všechno — data, fotky i snapshoty. */
export async function wipeEverything(): Promise<void> {
  revokeAllImageUrls();
  for (const storeName of [STORE_STATE, STORE_IMAGES, STORE_BACKUPS]) {
    try {
      await runTransaction(storeName, "readwrite", (store) => store.clear());
    } catch (error) {
      console.error(`Recepty Terinky: čištění ${storeName} selhalo`, error);
    }
  }
  clearLegacyStorage();
}
