# Recepty Terinky

Osobní kuchařka: recepty, ingredience, domácí zásoby, nákupní seznam a týdenní
plán jídel. Funguje offline, data zůstávají v prohlížeči a volitelně se dají
synchronizovat mezi zařízeními přes vlastní server.

## Co aplikace umí

**Recepty**
- hledání v názvech, ingrediencích, štítcích i postupu, bez ohledu na diakritiku
  a s tolerancí překlepů
- filtry podle štítků, celkového času a počtu chybějících ingrediencí
  („ukaž mi, kde mi chybí jediná věc")
- řazení mimo jiné podle toho, kolik toho doma chybí, nebo podle hodnocení
- přepočet množství na jiný počet porcí
- import z odkazu (čte `schema.org/Recipe` z webu) i z nakopírovaného textu
- sdílení, tisk na jeden list, duplikace

**Vaření**
- celoobrazovkový režim krok za krokem s velkým písmem
- obrazovka nezhasne (Screen Wake Lock)
- z textu kroku („vař 20 minut") se udělá tapnutelný časovač s notifikací
- odškrtávání ingrediencí přímo u kroku
- po dovaření zápis do historie: datum, počet porcí, hodnocení, poznámka

**Zásoby a nákup**
- u položky ve spíži jde vést množství i datum spotřeby, tři dny předem přijde
  upozornění
- nákupní seznam z receptu nebo z celého naplánovaného týdne; stejné ingredience
  se slučují a množství sčítá (200 g + 300 g mouky = 500 g, 2 lžíce + 50 ml = 80 ml)
- co je doma, se z nákupu automaticky vynechá
- odškrtané položky jde po nákupu přesunout rovnou do spíže

**Plán**
- týdenní menu se čtyřmi sloty na den, na počítači i přetažením receptu
- z celého týdne jeden nákupní seznam

**Zbytek**
- Zpět / Znovu (Cmd+Z, Cmd+Shift+Z) přes posledních 30 změn
- světlý i tmavý motiv, respektuje nastavení systému
- každý recept má vlastní adresu, takže jde poslat odkazem a tlačítko Zpět
  v prohlížeči funguje, jak má
- PWA: instalovatelná, funkční offline

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- žádný CSS framework — vlastní custom properties v `app/globals.css`
- ikony `lucide-react`, fonty Fraunces + Manrope přes `next/font`
- data v IndexedDB, fotky jako `Blob`
- testy: vitest (logika) + Playwright (průchody aplikací)

## Lokální vývoj

Doporučený Node runtime je `22.x` (viz `.nvmrc`).

```bash
nvm use
npm install
npm run dev
```

Pozn.: `dev` i `build` používají `--webpack`. Na tomhle vývojovém stroji padal
nativní SWC binding; na Vercelu se tenhle přepínač nepoužívá a build běží
standardně.

## Kontrola

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # vitest — čistá logika
npm run test:e2e   # Playwright — průchody aplikací proti produkčnímu buildu
```

E2E testy si samy spustí produkční server (`scripts/serve-standalone.mjs`),
takže před nimi stačí `npm run build`. V prostředí, kde už Chromium je
a nemá se stahovat, se dá předat cesta přes `CHROMIUM_PATH`.

Všechno tohle hlídá i CI (`.github/workflows/ci.yml`) na každém pushi.

## Kde co je

```
app/              layout, globální styly, API routy
  api/sync/         synchronizace mezi zařízeními
  api/import-recipe/ import receptu z URL
components/
  app/              stav (reducer + historie), routování, motiv, toasty
  ui/               modal, virtualizovaný seznam, hvězdičky, prázdné stavy
  recipes/          seznam, detail, formulář, režim vaření, import
  ingredients/      seznam ingrediencí, spíž, výběr ingredience
  shopping/         nákupní seznam
  planner/          týdenní plánovač
  settings/         zálohy, snapshoty, synchronizace, stav úložiště
lib/                čistá logika — doména, migrace, hledání, jednotky,
                    nákup, plánovač, časovače, import, úložiště
e2e/                Playwright testy
```

## Data

Stav aplikace žije v **IndexedDB** (`recepty-terinky`), fotky receptů jako
binární `Blob` mimo hlavní záznam. Data z předchozích verzí uložená
v `localStorage` se při prvním spuštění automaticky přenesou.

Verze schématu je uložená spolu s daty; migrace jsou v `lib/migrations.ts`,
takže i starší záloha jde vždycky dohrát.

Při prvním spuštění se naseeduje seznam ingrediencí
(`assets/seeds/default_ingredients_v1.json`) a 20 výchozích receptů
(`assets/seeds/default_recipes_v1.json`).

### Zálohy

- **Export do souboru** — jediná záloha, která přežije i smazání dat prohlížeče.
- **Automatické snapshoty** — aplikace si sama drží posledních 5 verzí v IndexedDB
  pro rychlý návrat, když se něco pokazí.
- **Záchranný snapshot** — při zavření záložky se stav synchronně odloží do
  `localStorage`, protože zápis do IndexedDB je asynchronní a prohlížeč ho může
  utnout. Při dalším startu se použije, jen když je novější.

### Synchronizace mezi zařízeními (volitelná)

Bez ní žijí data jen v jednom prohlížeči. Endpoint `/api/sync` běží spolu
s aplikací a ukládá stav do jednoho JSON souboru — pro osobní kuchařku to bohatě
stačí a nepřidává to žádnou závislost.

Proměnné prostředí:

| Proměnná | Význam |
| --- | --- |
| `SYNC_TOKEN` | Povinný sdílený tajný klíč. Bez něj je endpoint vypnutý (vrací 503). |
| `SYNC_DATA_DIR` | Adresář pro data, výchozí `.data` vedle aplikace. |

Stejný token se pak vyplní v aplikaci v **Data a zálohy → Synchronizace**.

Konflikty se neřeší automaticky: když se od poslední synchronizace změnilo
zařízení i server, aplikace ukáže obě verze a nechá rozhodnout uživatele.

> **Pozor na Vercel:** tamní filesystém je efemérní a soubor po redeployi zmizí.
> Pro trvalý provoz je potřeba self-hosting s připojeným svazkem (viz `Dockerfile`),
> nebo si `readDocument` / `writeDocument` v `app/api/sync/route.ts` přepsat na
> skutečné úložiště.

## Nasazení

**Push na `main` sám o sobě nic nenasadí.** Ostrý web běží jako self-hosted
Next.js za Cloudflare (odpovídá hlavičkami `x-nextjs-cache` a `x-powered-by`,
ne `x-vercel-id`), takže se po pushi musí ručně přestavět obraz a restartovat
kontejner:

```bash
git pull
docker compose build --no-cache   # nebo: docker build -t recepty .
docker compose up -d
```

Že běží nová verze, se pozná podle čtyř záložek v hlavičce (Recepty,
Ingredience, Nákup, Plán). Rychlá kontrola zvenčí:

```bash
curl -s https://recepty.anikin.cz/ | grep -c hlavni-obsah   # 0 = starý build
```

`Dockerfile` v rootu staví `output: standalone`. Pro synchronizaci mezi
zařízeními připoj svazek na cestu z `SYNC_DATA_DIR` (jinak data zmizí
s restartem kontejneru).

**Cloudflare**: HTML se posílá s `s-maxage=31536000`. Když se po nasazení
pořád ukazuje stará verze, je na řadě *Purge cache* v Cloudflare.

**Vercel** by fungoval taky (framework se autodetekuje, Node `22.x`, žádný
vlastní build command) — jen tam tenhle web zrovna neběží. Pozor, že na
Vercelu je filesystém efemérní, takže by tam nefungovala synchronizace přes
`/api/sync`.
