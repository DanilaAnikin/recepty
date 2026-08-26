import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

import { parseRecipeFromHtml } from "@/lib/recipe-import";

/**
 * Import receptu z veřejné URL.
 *
 * Stahovat stránku musí server — z prohlížeče by to zablokoval CORS. Tím se
 * ale z endpointu stává potenciální SSRF nástroj: kdokoli by ho mohl přimět
 * sáhnout na interní adresu, kam se sám nedostane. Proto se před každým
 * požadavkem (i po každém přesměrování) ověřuje, že cíl je veřejná IP adresa.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const USER_AGENT = "ReceptyTerinky/1.0 (osobní kuchařka; import receptu)";

/** Rozsahy, na které se ze serveru nikdy nesmí sáhnout. */
function isPrivateAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const parts = address.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, včetně cloud metadat
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast a vyhrazené
    return false;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fe80")) return true; // link-local
    if (/^f[cd]/.test(normalized)) return true; // unique local
    // IPv4-mapované adresy (::ffff:10.0.0.1) posoudíme podle IPv4 části.
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return isPrivateAddress(mapped[1]);
    }
    return false;
  }

  return true;
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Tohle není platná adresa.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Podporované jsou jen adresy http a https.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // Přímo zadaná IP se ověří rovnou, jméno se nejdřív přeloží.
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Na tuhle adresu nemůžu sáhnout.");
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Adresu se nepodařilo přeložit.");
  }

  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Na tuhle adresu nemůžu sáhnout.");
  }

  return url;
}

/** Stáhne stránku a ručně projde přesměrování, aby se každý hop dal ověřit. */
async function fetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "cs,sk;q=0.9,en;q=0.8",
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Stránka neodpověděla včas.");
      }
      throw new Error("Stránku se nepodařilo načíst.");
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Stránka přesměrovává nikam.");
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(`Stránka odpověděla ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      throw new Error("Na téhle adrese není webová stránka.");
    }

    const html = await readLimited(response, MAX_BYTES);
    return { html, finalUrl: url.toString() };
  }

  throw new Error("Stránka přesměrovává příliš mnohokrát.");
}

/** Čte tělo odpovědi jen do daného limitu — nechceme si stáhnout gigabajt. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());

  return chunks.join("");
}

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Tělo požadavku není platný JSON." }, { status: 400 });
  }

  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (rawUrl.length === 0) {
    return NextResponse.json({ error: "Chybí adresa receptu." }, { status: 400 });
  }

  try {
    const { html, finalUrl } = await fetchHtml(rawUrl);
    const recipe = parseRecipeFromHtml(html, finalUrl);

    if (!recipe) {
      return NextResponse.json(
        {
          error:
            "Na stránce jsem nenašel strojově čitelný recept. Zkus text zkopírovat a vložit ručně.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import se nepodařil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
