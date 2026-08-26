# CLAUDE.md — Recepty Terinky

## Co to je

Osobní kuchařka / recipe manager pro jednoho uživatele (Terinku). Recepty,
ingredience, domácí zásoby, nákupní seznam, týdenní plán jídel a režim vaření.
Původně Flutter app, přepsaná do Next.js. Stav: funkční, deploy na Vercel
(nebo self-hosted přes Docker). Legacy Flutter kód je z repa odstraněný,
zůstává pod tagem `flutter-legacy-archive`.

## Stack

- TypeScript, React 19, Next.js 16 (App Router) — `next dev --webpack` (SWC binding padal, viz gotchas)
- Node 22.x (pinováno v `.nvmrc`: `22.13.1`)
- Data: **IndexedDB** (`recepty-terinky`), fotky jako `Blob` mimo hlavní záznam
- Volitelný sync na vlastní server přes `/api/sync`
- Ikony: `lucide-react`
- Fonty: Fraunces (display, `--font-display`), Manrope (body, `--font-body`) — Google Fonts přes `next/font`
- CSS: vlastní custom properties v `app/globals.css`, žádný CSS framework
- Lint: ESLint 9 flat config (`eslint.config.mjs`) — `eslint-config-next/core-web-vitals`
- Testy: vitest (`lib/**/*.test.ts`) + Playwright (`e2e/`)
- CI: GitHub Actions (`.github/workflows/ci.yml`) — lint, typecheck, vitest, e2e

## Architektura

- **Jednastránková SPA**: `app/page.tsx` renderuje `<ReceptyTerinkyApp />`.
- **Stav**: `components/app/app-state.tsx` — `useReducer` s historií (Zpět/Znovu,
  30 kroků). Každá změna dat jde přes `commit(updater, popisek)`, které zvýší
  `revision` a `updatedAt` (na tom stojí detekce konfliktů při syncu). Změny,
  které nejsou práce uživatele (motiv, řazení, nastavení syncu), se commitují
  s `{ track: false }`, aby je Cmd+Z nevracelo.
- **Mutace**: `lib/mutations.ts` — čisté funkce `AppState -> AppState`. Všechno,
  co mění data, jde přes ně; komponentám tak zbývá jen `commit(mutations.x)`
  a chování jde testovat bez Reactu.
- **Doménová vrstva** (`lib/`, všechno čisté a otestované):
  - `domain.ts` — typy, seed logika, normalizace (české locale, `Intl.Collator("cs")`)
  - `migrations.ts` — `SCHEMA_VERSION` + verzované migrace uložených dat
  - `search.ts` — skórované hledání s tolerancí překlepů
  - `filters.ts` — skládání filtrů + řazení, které potřebuje výsledek párování se spíží
  - `units.ts` — převody jednotek a slučování množství
  - `shopping.ts` — stavba nákupního seznamu
  - `planner.ts` — týdenní plán (data jako `YYYY-MM-DD` v **lokálním** čase)
  - `timers.ts` — vytahování časů z textu postupu
  - `recipe-import.ts` — JSON-LD i volný text
  - `recipe-text.ts` — recept jako prostý text pro sdílení
  - `storage.ts` / `images.ts` / `sync.ts` — úložiště, fotky, synchronizace (klient)
- **Routování**: přes parametry dotazu (`/?tab=nakup&recept=12`), čte se
  `useSyncExternalStore` v `components/app/use-route.ts`. Cesta zůstává `/`,
  takže reload funguje bez serverového routování.
- **Komponenty**: `components/{app,ui,recipes,ingredients,shopping,planner,settings}/`.
- **Theming**: CSS custom properties v `:root` / `:root[data-theme="dark"]`.
  Theme bootstrap script v `layout.tsx` čte úložiště **před hydratací** (FOUC).

## Konvence projektu

- Čeština v UI textech i v komentářích.
- Path alias `@/*` mapuje na root (`tsconfig.json` paths).
- `strict: true`, target ES2020.
- Sorting vždy přes `Intl.Collator("cs")` — nepoužívat `localeCompare` přímo
  (výjimka: `localeCompare(x, "cs")` tam, kde se řadí jednorázově).
- Nové jednotky přidat do `INGREDIENT_UNITS` v `lib/domain.ts` **a** do
  `UNIT_META` v `lib/units.ts`, jinak se nebudou umět sečíst.
- Nová mutace = čistá funkce v `lib/mutations.ts` + test.
- Nekompatibilní změna tvaru `AppState` = zvýšit `SCHEMA_VERSION` a doplnit
  migraci do `lib/migrations.ts`.

## Gotchas a non-obvious chování

- **SWC nefunguje lokálně**: na dev stroji padá nativní SWC binding, proto
  `--webpack` v `dev` i `build`. Na Vercelu se nepoužívá.
- **`next start` neumí `output: standalone`**: pro produkční náhled a e2e testy
  se používá `node scripts/serve-standalone.mjs`, který navíc dokopíruje
  `public/` a `.next/static/` (Next je do standalone nedává).
- **Zápis do IndexedDB je asynchronní** a prohlížeč ho při zavírání záložky
  utne. Proto se v `pagehide` synchronně odkládá záchranný snapshot do
  `localStorage` (`RECOVERY_KEY`) a při dalším startu se použije, jen když má
  vyšší `revision`. Nemazat — bez toho se poslední akce dá ztratit.
- **Persister má náběžnou hranu**: první změna po klidu se zapisuje okamžitě,
  teprve další se slévají. Záměr, ne bug — jinak by mezi akcí a zápisem bylo
  400ms okno.
- **UI se nevykreslí před hydratací**: dokud `hydrated` není `true`, obsah
  nahrazuje `.loading-panel`. Kdyby šlo klikat dřív, hydratace by změnu
  přepsala.
- **Nákupní seznam je jeden seznam, ne dva.** Odškrtnuté položky se řadí dolů,
  ale zůstávají ve stejném `<ul>`. Kdyby přeskakovaly do samostatného seznamu,
  zanikl by původní prvek v DOM a jeho checkbox by se nikdy nestal zaškrtnutým —
  pro čtečku obrazovky i pro automatizaci nefunkční ovládací prvek.
- **`.hero-card` má `z-index: 3`**: `backdrop-filter` na hero i na panelech
  zakládá vlastní stacking context, takže bez toho panel s filtry překryl
  rozbalenou nabídku motivu.
- **Flexové položky v plánovači potřebují `min-width: 0`**, jinak dlouhý název
  receptu roztáhne celý sloupec a vytlačí datum z hlavičky dne.
- **`ensureSeedData` se volá při každém commitu**: wrapper v reduceru vždycky
  provede seed kontrolu a přetřídění. Záměr.
- **`createInitialState()` neseeduje recepty** — ty dolije až `ensureSeedData`.
  V `loadState` je proto `ensureSeedData(createInitialState())`.
- **`recipelessNormalize`** už neexistuje (byl to jen alias na `normalizeText`).
- **`/api/import-recipe` je SSRF-citlivé místo**: sahá na cizí URL ze serveru.
  Překládá jméno na IP a odmítá privátní rozsahy včetně cloud metadat, ověřuje
  každé přesměrování zvlášť a omezuje velikost odpovědi. Při úpravách to nerozbít.
- **Sync neslévá automaticky**: když se změnilo zařízení i server, vrátí se
  `conflict` a rozhoduje uživatel.

## Jak něco udělat

- Spustit lokálně: `nvm use && npm install && npm run dev`
- Build: `npm run build`
- Produkční náhled: `npm run build && node scripts/serve-standalone.mjs`
- Lint: `npm run lint` · Typy: `npm run typecheck`
- Testy logiky: `npm test` (vitest) / `npm run test:watch`
- E2E: `npm run build && npm run test:e2e` (Playwright, desktop + mobil)
- Deploy: push na main, Vercel autodetekuje Next.js

## Co tu NENÍ

`app/globals.css` má přes 2 300 řádků a neprošel jsem ho celý řádek po řádku —
znám strukturu proměnných, komponentní bloky a media queries. Vzdálené fotky
z Unsplash (výchozí recepty) se v tomhle prostředí nedají načíst, takže vzhled
karet s fotkou jsem viděl jen s prázdným placeholderem.
