# CLAUDE.md — Recepty Terinky

## Co to je

Osobní kuchařka / recipe manager pro jednoho uživatele (Terinku). Správa receptů, ingrediencí a domácích zásob s dark mode. Původně Flutter app, přepsána do Next.js — Flutter kód v repo zůstává jako legacy. Stav: funkční MVP, deploy na Vercel.

## Stack

- TypeScript, React 19, Next.js 16 (App Router) — `next dev --webpack` (SWC binding padal, viz gotchas)
- Node 22.x (pinováno v `.nvmrc`: `22.13.1`)
- Žádný backend, žádná DB — vše v `localStorage` pod klíčem `recepty-terinky.next.v1`
- Ikony: `lucide-react`
- Fonty: Fraunces (display, `--font-display`), Manrope (body, `--font-body`) — Google Fonts přes `next/font`
- CSS: vlastní custom properties v `globals.css`, žádný CSS framework
- Lint: ESLint 9 flat config (`eslint.config.mjs`) — `eslint-config-next/core-web-vitals`
- Deploy: Vercel (Next.js autodetekce)
- Legacy: Flutter 3.38, Dart, Codemagic CI — nepoužívá se pro produkci

## Architektura

- **Jednastránková SPA**: `app/page.tsx` renderuje jedinou komponentu `<ReceptyTerinkyApp />`.
- **Mega-komponenta**: veškerá UI logika žije v `components/recepty-terinky-app.tsx` (1668 řádků, `"use client"`). Obsahuje správu stavu (useState), všechny handlery, všechny podkomponenty — vše v jednom souboru.
- **Doménová vrstva**: `lib/domain.ts` (342 řádků) — typy (`Ingredient`, `Recipe`, `AppState`), serializace/deserializace localStorage, normalizace textu (české locale, `Intl.Collator("cs")`), seed logika, matching receptů.
- **Seed data**: `assets/seeds/default_ingredients_v1.json` — 300+ defaultních ingrediencí v češtině. Při prvním načtení se naseedují do stavu; při upgrade `SEED_VERSION` se dolijou chybějící.
- **Theming**: CSS custom properties v `:root` / `:root[data-theme="dark"]`. Theme bootstrap script v `layout.tsx` čte localStorage **před hydratací** aby zabránil FOUC.
- **Žádný routing**: App Router se používá jen pro layout/page wrapper; navigace mezi "screeny" (recepty, ingredience, detail, formulář) je řešená přes React stav v mega-komponentě.
- **Obrázky receptů**: ukládají se jako data URL přímo do localStorage (přes `FileReader.readAsDataURL`).

## Konvence projektu

- Čeština v UI textech, názvech proměnných občas česky (např. `recipelessNormalize`, ale label texty jako `"Vyber ingredienci"`).
- Path alias `@/*` mapuje na root (`tsconfig.json` paths).
- `strict: true` v TypeScript.
- Jeden soubor = jedna feature oblast (domain.ts pro logiku, recepty-terinky-app.tsx pro celé UI).
- Sorting vždy přes `Intl.Collator("cs")` — nepoužívat `localeCompare` přímo.
- State update přes `updateAppState(updater)` wrapper, který vždy volá `ensureSeedData`.
- Nové jednotky přidat do `INGREDIENT_UNITS` v `lib/domain.ts`.

## Gotchas a non-obvious chování

- **SWC nefunguje lokálně**: Na dev stroji padá nativní SWC binding. Proto `package.json` explicitně používá `--webpack` flag pro `dev` i `build`. Na Vercelu funguje standardně bez tohoto flagu.
- **Obrázky jako data URL v localStorage**: Fotky receptů se ukládají jako base64 data URL přímo do localStorage. Při větším počtu receptů s fotkami může localStorage narazit na limit (~5-10 MB dle prohlížeče). `next/image` je použitý s `unoptimized` — obrázky se neoptimalizují.
- **Zápis do localStorage je obalen try/catch s toastem**: Persistování stavu v komponentě je v `try/catch`; při překročení kvóty (QuotaExceededError) se uživateli ukáže toast s výzvou zálohovat data (Export) nebo uvolnit místo smazáním fotek. Zápis pak neshodí appku.
- **Theme bootstrap script**: V `layout.tsx` je inline script s `strategy="beforeInteractive"` + `suppressHydrationWarning` na `<html>`. Toto je záměrné — čte localStorage před hydratací aby nastavil `data-theme`. Nemazat.
- **`ensureSeedData` se volá při každém state update**: Wrapper `updateAppState` vždy provede seed kontrolu a přetřídění. To je záměr, ne bug.
- **Legacy Flutter kód**: Adresáře `lib/app/`, `lib/core/`, `lib/data/`, `lib/features/`, `lib/shared/`, `android/`, `ios/`, `web/`, `test/` obsahují starý Flutter/Dart kód. Nejsou součástí Next.js buildu, ale jsou v repo. `lib/domain.ts` a `lib/main.dart` koexistují ve stejném `lib/` adresáři.
- **`recipelessNormalize`** je jen alias na `normalizeText` — vypadá to jako leftover po refactoru, ale je aktivně používaný v komponentě.
- **`pubspec.yaml` a `codemagic.yaml`** v rootu jsou pro legacy Flutter build. `vercel.json` je pro aktuální Next.js deploy.

## Jak něco udělat

- Spustit lokálně: `nvm use && npm install && npm run dev`
- Build: `npm run build` (lokálně s `--webpack`, na Vercelu standardně)
- Lint: `npm run lint`
- Deploy: push na main, Vercel autodetekuje Next.js a buildne
- Spustit testy: `npm test` (vitest run, jednorázově) nebo `npm run test:watch` (vitest watch). Testy běží přes vitest, config je `vitest.config.ts`, hledají se v `lib/**/*.test.ts`. Pozn.: `test/widget_test.dart` je starý Flutter test, ne vitest.

## Co tu NENÍ

Neprozkoumával jsem detailně obsah `globals.css` (927 řádků CSS) — viděl jsem jen strukturu proměnných a reset. Flutter legacy kód (`lib/app/`, `lib/features/`, `lib/data/` atd.) jsem procházel jen na úrovni adresářové struktury, ne obsah Dart souborů. Testy pro Next.js verzi neexistují.
