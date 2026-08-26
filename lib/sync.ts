"use client";

import { normalizeState, type AppState, type SyncSettings } from "./domain";

/**
 * Volitelná synchronizace stavu na vlastní server.
 *
 * Data aplikace jinak žijí jen v jednom prohlížeči na jednom zařízení. Tahle
 * vrstva umí stav vytlačit na endpoint (`/api/sync` běžící vedle aplikace,
 * nebo cokoli jiného se stejným protokolem) a stáhnout ho na druhém zařízení.
 *
 * Protokol je schválně triviální:
 *   GET  <endpoint>  -> 200 { revision, updatedAt, state } | 204 (zatím nic)
 *   PUT  <endpoint>  -> 200 { revision } | 409 { revision, updatedAt, state }
 * Autorizace hlavičkou `Authorization: Bearer <token>`.
 *
 * Konflikty se neřeší automaticky. Když se změnila obě místa, vrátí se
 * `conflict` i s protistranou a rozhodne uživatel — tiché slití dvou kuchařek
 * by nadělalo víc škody než užitku.
 */

export type SyncOutcome =
  | { status: "disabled" }
  | { status: "in-sync"; revision: number }
  | { status: "pushed"; revision: number }
  | { status: "pulled"; state: AppState; revision: number }
  | { status: "conflict"; remoteState: AppState; remoteRevision: number; remoteUpdatedAt: string }
  | { status: "error"; message: string };

type RemoteDocument = {
  revision: number;
  updatedAt: string;
  state: unknown;
};

const REQUEST_TIMEOUT_MS = 15_000;

function authHeaders(settings: SyncSettings): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.token.trim().length > 0) {
    headers.Authorization = `Bearer ${settings.token.trim()}`;
  }
  return headers;
}

async function withTimeout<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await action(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Server neodpověděl včas.";
  }
  if (error instanceof TypeError) {
    return "Server je nedostupný. Zkontroluj adresu a připojení.";
  }
  return error instanceof Error ? error.message : "Neznámá chyba synchronizace.";
}

async function readRemote(settings: SyncSettings): Promise<RemoteDocument | null> {
  const response = await withTimeout((signal) =>
    fetch(settings.endpoint, { method: "GET", headers: authHeaders(settings), signal, cache: "no-store" }),
  );

  if (response.status === 204 || response.status === 404) {
    return null;
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Server odmítl token.");
  }
  if (!response.ok) {
    throw new Error(`Server odpověděl ${response.status}.`);
  }

  const body = (await response.json()) as Partial<RemoteDocument>;
  if (typeof body?.revision !== "number") {
    return null;
  }
  return {
    revision: body.revision,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : new Date(0).toISOString(),
    state: body.state,
  };
}

async function writeRemote(
  settings: SyncSettings,
  state: AppState,
  baseRevision: number,
): Promise<{ ok: true; revision: number } | { ok: false; remote: RemoteDocument }> {
  const response = await withTimeout((signal) =>
    fetch(settings.endpoint, {
      method: "PUT",
      headers: authHeaders(settings),
      signal,
      body: JSON.stringify({ baseRevision, state }),
    }),
  );

  if (response.status === 409) {
    const body = (await response.json()) as Partial<RemoteDocument>;
    return {
      ok: false,
      remote: {
        revision: typeof body?.revision === "number" ? body.revision : 0,
        updatedAt: typeof body?.updatedAt === "string" ? body.updatedAt : new Date(0).toISOString(),
        state: body?.state,
      },
    };
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Server odmítl token.");
  }
  if (!response.ok) {
    throw new Error(`Server odpověděl ${response.status}.`);
  }

  const body = (await response.json()) as { revision?: number };
  return { ok: true, revision: typeof body?.revision === "number" ? body.revision : baseRevision + 1 };
}

/**
 * Jedno kolo synchronizace.
 *
 * Rozhoduje se podle `lastSyncedRevision` — revize, na které se obě strany
 * naposledy shodly. Když se od té doby změnila jen jedna strana, je jasné,
 * kam data patří; když obě, je to konflikt.
 */
export async function syncNow(state: AppState, settings: SyncSettings): Promise<SyncOutcome> {
  if (!settings.enabled || settings.endpoint.trim().length === 0) {
    return { status: "disabled" };
  }

  try {
    const remote = await readRemote(settings);
    const localChanged = state.revision > settings.lastSyncedRevision;

    if (!remote) {
      const written = await writeRemote(settings, state, settings.lastSyncedRevision);
      if (!written.ok) {
        return {
          status: "conflict",
          remoteState: normalizeState(written.remote.state),
          remoteRevision: written.remote.revision,
          remoteUpdatedAt: written.remote.updatedAt,
        };
      }
      return { status: "pushed", revision: written.revision };
    }

    const remoteChanged = remote.revision > settings.lastSyncedRevision;

    if (remoteChanged && localChanged) {
      return {
        status: "conflict",
        remoteState: normalizeState(remote.state),
        remoteRevision: remote.revision,
        remoteUpdatedAt: remote.updatedAt,
      };
    }

    if (remoteChanged) {
      return {
        status: "pulled",
        state: normalizeState(remote.state),
        revision: remote.revision,
      };
    }

    if (localChanged) {
      const written = await writeRemote(settings, state, remote.revision);
      if (!written.ok) {
        return {
          status: "conflict",
          remoteState: normalizeState(written.remote.state),
          remoteRevision: written.remote.revision,
          remoteUpdatedAt: written.remote.updatedAt,
        };
      }
      return { status: "pushed", revision: written.revision };
    }

    return { status: "in-sync", revision: remote.revision };
  } catch (error) {
    return { status: "error", message: describeError(error) };
  }
}

/** Vynutí přepis serveru lokálním stavem — použije se při ručním řešení konfliktu. */
export async function forcePush(state: AppState, settings: SyncSettings): Promise<SyncOutcome> {
  try {
    const remote = await readRemote(settings);
    const baseRevision = remote?.revision ?? 0;
    const written = await writeRemote(settings, state, baseRevision);
    if (!written.ok) {
      return { status: "error", message: "Server se mezitím znovu změnil, zkus to prosím ještě jednou." };
    }
    return { status: "pushed", revision: written.revision };
  } catch (error) {
    return { status: "error", message: describeError(error) };
  }
}
