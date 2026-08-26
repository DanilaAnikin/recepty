import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

/**
 * Vyrobí screenshoty pro `manifest.webmanifest`.
 *
 * Prohlížeč je ukazuje v instalačním dialogu PWA — bez nich vypadá nabídka
 * instalace chudě. Rozměry musí odpovídat tomu, co je v manifestu zapsané.
 *
 * Spouští se ručně po větší změně vzhledu:
 *   npm run build && node scripts/capture-screenshots.mjs
 *
 * Předpokládá běžící server na `SCREENSHOT_URL` (výchozí http://127.0.0.1:3300).
 */

const BASE = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:3300";
const OUT = "public/screenshots";

const SHOTS = [
  { name: "desktop-recepty", width: 1280, height: 800, path: "/" },
  { name: "desktop-plan", width: 1280, height: 800, path: "/?tab=plan" },
  { name: "mobil-recepty", width: 390, height: 844, path: "/" },
  { name: "mobil-nakup", width: 390, height: 844, path: "/?tab=nakup" },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}${shot.path}`, { waitUntil: "domcontentloaded" });
  // Počkej na dohydratování, ať se nefotí načítací panel.
  await page.locator(".loading-panel").waitFor({ state: "detached", timeout: 15_000 });
  await page.waitForTimeout(900);

  await page.screenshot({ path: `${OUT}/${shot.name}.png` });
  await context.close();
  console.log(`${shot.name}.png (${shot.width}×${shot.height})`);
}

await browser.close();
