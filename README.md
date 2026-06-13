# Recepty Terinky

Next.js verze aplikace pro recepty, ingredience, domácí zásoby a přepínatelný dark mode.

## Stack

- Next.js App Router
- React 19
- TypeScript
- klientská perzistence do `localStorage`

## Lokální vývoj

Doporučený Node runtime je `22.x`.

```bash
nvm use
npm install
npm run dev
```

## Kontrola

```bash
npm run lint
npm run build
npm test
```

Pro spuštění testů (`npm test`, vitest) je potřeba nejdřív `npm install` — vitest je v `devDependencies`.

Poznámka k tomuto stroji:
Lokální build byl ověřený pod Node `22.13.1`. V tomto konkrétním prostředí padal nativní SWC binding, takže pro ověření byl použit build s `NEXT_TEST_WASM=1 npm run build`. Na Vercelu má projekt běžet jako standardní Next.js app.

## Nasazení na Vercel

1. Pushni repo.
2. Ve Vercelu nastav framework na `Next.js` nebo nech autodetekci.
3. Použij Node `22.x`.
4. Není potřeba vlastní build command ani output directory.

## Datový model

Aplikace si na klientovi ukládá:

- seznam ingrediencí
- recepty včetně obrázků uložených jako data URL
- domácí zásoby
- volbu theme modu

Při prvním spuštění se automaticky seeduje základní seznam ingrediencí z `assets/seeds/default_ingredients_v1.json`.

## Zálohování dat

Protože všechna data žijí jen v `localStorage` prohlížeče, aplikace nabízí ruční zálohu:

- **Export JSON** — stáhne aktuální stav (ingredience, recepty, zásoby, volba theme) jako JSON soubor, který si můžeš uložit.
- **Import JSON** — načte dříve exportovaný soubor a nahradí jím celý stav aplikace.

Doporučení: před vymazáním dat prohlížeče nebo přechodem na jiné zařízení si data vyexportuj a po obnově je naimportuj zpět.
