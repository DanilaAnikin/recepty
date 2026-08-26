import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Endpoint pro synchronizaci stavu mezi zařízeními.
 *
 * Záměrně bez databáze a bez další závislosti — stav je jeden JSON soubor.
 * Pro osobní kuchařku jednoho člověka je to naprosto dostačující a hlavně to
 * jde provozovat vedle aplikace v Dockeru (`Dockerfile` v rootu) s jedním
 * připojeným svazkem.
 *
 * Konfigurace přes proměnné prostředí:
 *   SYNC_TOKEN     – povinný sdílený tajný klíč. Bez něj je endpoint vypnutý.
 *   SYNC_DATA_DIR  – adresář pro data (výchozí `.data` vedle aplikace).
 *
 * Pozor na Vercel: tamní filesystém je efemérní, soubor po redeployi zmizí.
 * Pro trvalý provoz je potřeba self-hosting se svazkem, nebo si `readDocument`
 * a `writeDocument` přepsat na skutečné úložiště.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncDocument = {
  revision: number;
  updatedAt: string;
  state: unknown;
};

function dataDirectory(): string {
  return process.env.SYNC_DATA_DIR ?? path.join(process.cwd(), ".data");
}

function documentPath(): string {
  return path.join(dataDirectory(), "sync-state.json");
}

/** Porovnání tokenů v konstantním čase, aby nešlo token uhodnout po znacích. */
function tokensMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    // `timingSafeEqual` na různých délkách vyhodí — délku porovnáme zvlášť.
    // Samotná délka tokenu není citlivá informace.
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

function authorize(request: Request): { ok: true } | { ok: false; response: NextResponse } {
  const expected = process.env.SYNC_TOKEN;

  if (!expected || expected.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Synchronizace není na serveru zapnutá. Nastav proměnnou SYNC_TOKEN." },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (provided.length === 0 || !tokensMatch(provided, expected)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Neplatný token." }, { status: 401 }),
    };
  }

  return { ok: true };
}

async function readDocument(): Promise<SyncDocument | null> {
  try {
    const raw = await readFile(documentPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SyncDocument>;
    if (typeof parsed?.revision !== "number") {
      return null;
    }
    return {
      revision: parsed.revision,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      state: parsed.state,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Zápis přes dočasný soubor a přejmenování — kdyby proces spadl uprostřed,
 * nezůstane na disku useknutý JSON místo dat.
 */
async function writeDocument(document: SyncDocument): Promise<void> {
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const target = documentPath();
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(document), "utf8");
  await rename(temporary, target);
}

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const document = await readDocument();
    if (!document) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(document);
  } catch (error) {
    console.error("Sync GET selhalo", error);
    return NextResponse.json({ error: "Nepodařilo se přečíst data." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  let body: { baseRevision?: unknown; state?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Tělo požadavku není platný JSON." }, { status: 400 });
  }

  if (!body || typeof body.state !== "object" || body.state === null) {
    return NextResponse.json({ error: "Chybí stav aplikace." }, { status: 400 });
  }

  const baseRevision =
    typeof body.baseRevision === "number" && Number.isFinite(body.baseRevision)
      ? Math.max(0, Math.floor(body.baseRevision))
      : 0;

  try {
    const current = await readDocument();

    // Klient zapisuje nad revizí, kterou naposledy viděl. Když je na serveru
    // novější, mezitím zapsalo jiné zařízení — a rozhodnout musí uživatel.
    if (current && current.revision > baseRevision) {
      return NextResponse.json(current, { status: 409 });
    }

    const next: SyncDocument = {
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      state: body.state,
    };
    await writeDocument(next);

    return NextResponse.json({ revision: next.revision, updatedAt: next.updatedAt });
  } catch (error) {
    console.error("Sync PUT selhalo", error);
    return NextResponse.json({ error: "Nepodařilo se uložit data." }, { status: 500 });
  }
}
