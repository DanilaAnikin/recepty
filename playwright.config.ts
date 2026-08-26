import { defineConfig, devices } from "@playwright/test";

/**
 * E2E testy běží proti produkčnímu buildu, ne proti dev serveru — chceme
 * ověřovat to, co se doopravdy nasadí (včetně service workeru a minifikace).
 *
 * `output: standalone` v `next.config.ts` znamená, že `next start` protestuje;
 * spouštíme proto rovnou vygenerovaný `server.js`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3300);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * V prostředích, kde už Chromium je a stahovat se nemá (kontejnery s předem
 * připravenými prohlížeči), stačí nastavit `CHROMIUM_PATH`. V CI se proměnná
 * nenastavuje a Playwright použije vlastní stažený prohlížeč.
 */
const browserOverride = process.env.CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
  : {};

export default defineConfig({
  testDir: "./e2e",
  // Testy sdílejí jeden prohlížeč a spoléhají na vlastní IndexedDB v každém
  // kontextu; paralelizace by je nerozbila, ale sériový běh dává čitelnější log.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Výchozí recepty odkazují na fotky z Unsplash. V CI (a v sandboxu) na ně
    // není konektivita a `networkidle` by se nikdy nedočkal — testy proto
    // čekají na konkrétní prvky, ne na klid sítě.
    actionTimeout: 10_000,
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...browserOverride } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...browserOverride } },
  ],

  webServer: {
    command: `node scripts/serve-standalone.mjs`,
    url: BASE_URL,
    // Vždycky vlastní server. Sdílení s běžícím procesem sice šetří pár vteřin,
    // ale zapomenutý server ze staršího buildu pak testuje starý kód a hledá se
    // to mizerně.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: `${PORT}`,
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
  },
});
