import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Spustí produkční server z `output: standalone`.
 *
 * Next do `.next/standalone` zkopíruje jen server a závislosti — `public/`
 * a `.next/static/` se musí doplnit ručně (viz dokumentace Next.js). Bez toho
 * by se aplikace spustila, ale bez stylů, ikon a service workeru.
 *
 * Používá se pro e2e testy a jde s ním spustit i lokální náhled produkčního
 * buildu (`next start` se s `output: standalone` neslučuje).
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Chybí .next/standalone/server.js — nejdřív spusť `npm run build`.");
  process.exit(1);
}

await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});

process.chdir(standalone);
await import(path.join(standalone, "server.js"));
