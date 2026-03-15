# IMPLEMENTATION PLAN 1

## 1. CIL APLIKACE

Vytvorit lokalni iOS-first Flutter aplikaci pro osobni spravu receptu s nazvem `Recepty Terinky` a vizualnim srdickem v UI.

Hlavni cile:
- uzivatel spravuje vlastni recepty bez backendu
- aplikace obsahuje 300+ defaultnich ingredienci v cestine
- uzivatel umi ingredience vyhledavat, pridavat, upravovat, mazat a oznacovat jako oblibene
- uzivatel umi vytvaret recepty s mnozstvim, jednotkami, postupem, fotkou a poctem vareni
- prvni screen po otevreni aplikace je seznam receptu
- seznam receptu umi rezim `Cele` a `Castecne`
- filtrovani receptu funguje podle ingredienci, ktere ma uzivatel aktualne vybrane jako dostupne

Produktove rozhodnuti pro MVP:
- aplikace bude fungovat plne lokalne
- neni potreba login ani cloud sync
- u matchingu receptu se pro MVP ignoruje mnozstvi domacich zasob; kontroluje se pouze pritomnost ingredience
- mnozstvi a jednotky se ukladaji pouze na uroven receptove polozky

## 2. HLAVNI FUNKCNI ROZSAH

### 2.1 Screen 1: Recepty

Po otevreni aplikace se zobrazi `RecipesScreen`.

Obsah:
- app bar s nazvem `Recepty Terinky` a srdickovym motivem v UI
- vyhledavani receptu podle nazvu
- vyber ingredienci, ktere ma uzivatel doma
- prepinac modu `Cele` / `Castecne`
- abecedne serazeny seznam receptu
- moznost pridat novy recept
- moznost otevrit detail receptu
- moznost rychle navysit `Pocet vareni` tlacitkem `+`
- moznost upravit `Pocet vareni` rucne
- moznost upravit a smazat recept

Chovani modu:
- `Cele`: zobrazi se jen recepty, u kterych vsechny receptove ingredience existuji ve vybranych ingrediencich uzivatele
- `Castecne`: zobrazi se recepty, ktere obsahuji alespon 1 vybranou ingredienci; u kazdeho receptu se zobrazi chybejici ingredience cervene

Vyhledavani:
- textove vyhledavani musi prohledavat `nazev receptu`
- filtrovani podle ingredienci musi pracovat nad aktualne vybranymi ingrediencemi uzivatele
- v budoucnu muze byt doplneno fulltext hledani i pres nazvy ingredienci v receptu; pro MVP je to doporucene uz v prvni verzi

### 2.2 Screen 2: Ingredience

Samostatny screen pro spravu vsech ingredienci.

Obsah:
- vyhledavani ingredienci podle nazvu
- filtr `Vse` / `Oblibene`
- abecedne seskupeni s pismenovymi sekcemi
- moznost pridat vlastni ingredienci
- moznost upravit ingredienci
- moznost smazat ingredienci
- moznost oznacit/odznacit ingredienci jako oblibenou

Poznamka:
- tento screen je sprava master seznamu ingredienci
- vyber ingredienci "co mam doma" nebude primo zde povinny hlavni flow, ale bude sdileny pres samostatny selector pouzity z receptoveho screenu

### 2.3 Screen 3: Detail receptu

Obsah:
- nazev
- fotka receptu, pokud existuje
- pocet vareni
- seznam ingredienci s mnozstvim a jednotkou
- postup / popis presne podle zadanych dat
- akce `Upravit`, `Smazat`, `+ uvareno`, `Upravit pocet`

### 2.4 Screen 4: Formular receptu

Pouziti:
- vytvoreni receptu
- editace receptu

Polozky:
- `Nazev` povinny
- `Fotka` nepovinna, vyber z galerie
- `Popis / Postup` nepovinny
- dynamicky seznam ingredienci
- u kazde receptove polozky:
  - vyber ingredience
  - mnozstvi
  - jednotka
- moznost pridavat dalsi ingredience
- moznost odebirat ingredience
- moznost ulozit zmeny

### 2.5 Screen 5: Vyber ingredienci "mam doma"

Doporucene jako full-screen modal nebo bottom sheet s moznosti otevrit plnou stranku.

Obsah:
- sdilena komponenta listu ingredienci
- vyhledavani
- filtr `Vse` / `Oblibene`
- multi-select ingredienci
- potvrzeni vyberu
- rychle vycisteni vyberu

Tento screen/sluzba bude vstupem pro matching v receptech.

## 3. UX A NAVIGACE

Doporucena navigace:
- root `Scaffold` s `NavigationBar`
- zalozky:
  - `Recepty` (defaultni a prvni otevrena)
  - `Ingredience`

Vedlejsi navigace:
- `RecipeDetailScreen`
- `RecipeFormScreen`
- `PantrySelectorScreen`
- `IngredientFormSheet`
- `CountEditDialog`

Toky:
1. App launch -> `RecipesScreen`
2. Uzivatel klikne `Pridat recept` -> `RecipeFormScreen`
3. Uzivatel klikne recept -> `RecipeDetailScreen`
4. Uzivatel klikne `Vybrat ingredience` -> `PantrySelectorScreen`
5. Uzivatel klikne `Ingredience` v dolni navigaci -> `IngredientsScreen`

UX rozhodnuti:
- kdyz nejsou vybrane zadne domaci ingredience, seznam receptu zustane viditelny a nebude schovavat vsechny recepty
- po vybrani alespon 1 ingredience se aktivuje matching logika `Cele` / `Castecne`
- toto chovani je pro pouzitelnost lepsi nez prazdny seznam po prvnim otevreni

## 4. DATOVY MODEL

Navrh je local-first, bez backendu, s Isar databazi.

### 4.1 IngredientEntity

Ucel:
- master seznam ingredienci
- defaultni i uzivatelske ingredience
- oblibenost

Pole:
- `id: Id`
- `name: String`
- `normalizedName: String`
- `firstLetter: String`
- `isFavorite: bool`
- `isSystem: bool`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Pravidla:
- `normalizedName` bude slouzit pro unikatnost a hledani
- `firstLetter` bude predpocitane pismeno pro sekce listu
- `isSystem = true` pro seed ingredience
- `isSystem = false` pro uzivatelem pridane ingredience

### 4.2 RecipeEntity

Ucel:
- hlavni zaznam receptu

Pole:
- `id: Id`
- `title: String`
- `normalizedTitle: String`
- `description: String`
- `imagePath: String?`
- `cookingCount: int`
- `createdAt: DateTime`
- `updatedAt: DateTime`
- `ingredients: List<RecipeIngredientEmbedded>`

Pravidla:
- `cookingCount` nesmi byt zaporny
- `ingredients` musi obsahovat alespon 1 polozku

### 4.3 RecipeIngredientEmbedded

Ucel:
- snapshot ingredience uvnitr receptu
- zachovani receptu i po smazani ingredience z master seznamu

Pole:
- `ingredientId: Id?`
- `ingredientNameSnapshot: String`
- `normalizedIngredientName: String`
- `amount: double`
- `unit: IngredientUnit`

Duvod snapshotu:
- pokud uzivatel smaze ingredienci z master listu, recept nesmi prijit o historicka data
- detail receptu musi stale ukazat presny nazev, mnozstvi a jednotku
- matching bude primarne pouzivat `ingredientId`, fallback muze byt `normalizedIngredientName`

### 4.4 PantrySelectionEntity

Ucel:
- ulozit, ktere ingredience ma uzivatel aktualne doma
- oddelit "oblibene" od "mam doma"

Pole:
- `id: Id`
- `ingredientId: Id`
- `updatedAt: DateTime`

Poznamka:
- oblibene ingredience nejsou totez co domaci zasoba
- tato entita je jednodussi a cistsi nez pridavat `isInPantry` primo na ingredient

### 4.5 AppSettingsEntity

Ucel:
- seed verze
- dalsi drobna aplikacni nastaveni

Pole:
- `id: Id`
- `seedVersionApplied: int`

## 5. ENUMY A HODNOTY

### 5.1 IngredientUnit

Povolene jednotky pro MVP:
- `g`
- `kg`
- `ml`
- `l`
- `ks`
- `lzicka`
- `lzice`

Display label v UI:
- `g`, `kg`, `ml`, `l`, `ks`, `lzicka`, `lzice`

Poznamka:
- interni enum zustane ASCII
- UI label lze pozdeji lokalizovat

### 5.2 RecipeMatchMode

Hodnoty:
- `full`
- `partial`

UI label:
- `Cele`
- `Castecne`

## 6. DATABAZE A PERSISTENCE

Doporucena technologie:
- `isar`
- `isar_flutter_libs`
- `path_provider`

Duvody:
- lokalni databaze bez backendu
- rychle query
- vhodne pro iOS i Android
- jednoducha persistovana data pro osobni appku

Dalsi balicky:
- `flutter_riverpod` pro stav aplikace
- `image_picker` pro fotku z galerie
- `collection` pro pomocne operace nad sety a listy
- `intl` pro formaty, pokud bude potreba

Poznamka k webu:
- aplikace bude implementovana iOS-first
- web build muze fungovat castecne pro vyvoj, ale neni hlavni cil

## 7. SEED DEFAULTNICH INGREDIENCI

### 7.1 Zdroj dat

Vytvorit soubor:
- `assets/seeds/default_ingredients_v1.json`

Obsah:
- 300+ ceskych ingredienci
- zahrnout:
  - zakladni pecici suroviny
  - mlecne vyrobky
  - maso: kureci, veprove, hovezi, kruti, ryby
  - zelenina
  - ovoce
  - koreni
  - priloha
  - omacky
  - zakladni tekutiny

### 7.2 Pravidla importu

Pri prvnim spusteni:
- importovat seed ingredience do databaze
- nastavit `seedVersionApplied = 1`

Pri dalsim spusteni:
- seed znovu neimportovat

Dulezite pravidlo:
- pokud uzivatel smaze systemovou ingredienci, nesmi se pri dalsim spusteni sama vratit
- seed migrace v dalsich verzich musi respektovat uzivatelovy stav

Doporuceny pristup:
- seed v1 importovat pouze jednou
- budouci seed migrace resit explicitnim migracnim krokem, ne slepym "insert missing all"

## 8. VYHLEDAVANI, NORMALIZACE A TRIDENI

### 8.1 Normalizace textu

Vytvorit helper:
- lowercase
- trim
- odstraneni vicenasobnych mezer
- odstraneni diakritiky pro hledani

Priklady:
- `Cukr moucka` -> `cukr moucka`
- `Kureci maso` -> `kureci maso`

Pouziti:
- `normalizedName`
- `normalizedTitle`
- hledaci query

### 8.2 Serazeni ingredienci

Pravidla:
- podle `normalizedName`
- seskupeni podle `firstLetter`
- mezi pismeny vlozit male, ale tucne hlavicky sekci

### 8.3 Serazeni receptu

Pravidla:
- podle `normalizedTitle`
- pri stejnem nazvu sekundarne podle `updatedAt desc`

## 9. MATCHING LOGIKA RECEPTU

### 9.1 Vstupy

Potrebne vstupy:
- seznam receptu
- seznam vybranych domacich ingredienci
- mod `Cele` nebo `Castecne`
- textovy dotaz

### 9.2 Reprezentace

Vypocet bude pracovat nad mnozinou:
- `selectedIngredientIds`
- fallback `selectedNormalizedNames`

Pro kazdy recept:
- vytvorit mnozinu receptovych ingredienci
- matching ignoruje `amount`
- jednotka nema vliv na matching

### 9.3 Rezim Cele

Recept vyhovuje, pokud:
- uzivatel nema vybrane zadne ingredience -> recept se zobrazi normalne bez omezeni
- nebo vsechny ingredience receptu existuji ve vybrane mnozine

Pseudo-logika:
- `recipeIngredients.every(isSelected)`

### 9.4 Rezim Castecne

Recept vyhovuje, pokud:
- uzivatel nema vybrane zadne ingredience -> recept se zobrazi normalne bez omezeni
- nebo alespon jedna ingredience receptu existuje ve vybrane mnozine

Pseudo-logika:
- `recipeIngredients.any(isSelected)`

Pro preview:
- dopocitat `missingIngredients`
- v listu zobrazit chybejici ingredience cervene

### 9.5 Textove hledani

Recept projde textovym filtrem, pokud:
- `normalizedTitle` obsahuje hledany text
- nebo nektera `normalizedIngredientName` v receptu obsahuje hledany text

To znamena:
- uzivatel muze hledat podle nazvu receptu i podle ingredience

## 10. CHOVANI PRI MAZANI A UPRAVACH

### 10.1 Mazani ingredience

Pozadavek:
- uzivatel musi umet smazat jakoukoli ingredienci

Riziko:
- recept muze tuto ingredienci pouzivat

Rozhodnuti:
- receptove polozky uchovavaji snapshot nazvu, mnozstvi a jednotky
- pri smazani ingredience zustane recept funkcni
- `ingredientId` v receptovych polozkach se muze nulovat nebo prestat pouzivat

Dopad:
- detail receptu zustane korektni
- matching muze u smazane ingredience prestat fungovat pres ID
- fallback podle `normalizedIngredientName` lze pouzit jen pokud se stejna ingredience znovu vytvori

### 10.2 Uprava ingredience

Pravidla:
- lze upravit nazev
- pri uprave nazvu master ingredience se doporucuje nechat snapshoty v historickych receptech beze zmeny
- nove recepty uz pouziji novy nazev

Poznamka:
- recipy jsou historicky zaznam; neni nutne prepisovat vsechny existujici snapshoty

### 10.3 Mazani receptu

Pravidla:
- povolit po potvrzovacim dialogu
- smazani je trvale

### 10.4 Uprava poctu vareni

Pravidla:
- v detailu i v seznamu receptu musi byt tlacitko `+`
- musi existovat i akce `Upravit pocet`
- manualni uprava povoli korekci pri omylu
- hodnota nesmi klesnout pod `0`

## 11. NAVRH UI KOMPONENT

### 11.1 RecipeCard

Obsah:
- thumbnail fotky nebo placeholder
- nazev receptu
- kratky radek s poctem ingredienci
- badge nebo text s `Pocet vareni`
- tlacitko `+`
- v modu `Castecne` radek `Chybi: ...` cervene
- overflow menu `Upravit`, `Smazat`

### 11.2 IngredientListItem

Obsah:
- nazev ingredience
- ikona oblibene
- v selection modu checkbox nebo checkmark
- overflow menu `Upravit`, `Smazat`

### 11.3 AlphabetSectionHeader

Obsah:
- male, tucne pismeno sekce
- vizualne zretelne, ale ne prehnane dominantni

### 11.4 RecipeIngredientRow

Obsah:
- dropdown nebo picker ingredience
- text field pro mnozstvi
- picker jednotky
- tlacitko na odebrani radku

## 12. VALIDACE

### 12.1 Ingredience

Pravidla:
- nazev povinny
- po normalizaci musi byt unikatni
- prazdny nazev zakazan

### 12.2 Recept

Pravidla:
- nazev povinny
- alespon 1 ingredience povinna
- mnozstvi musi byt `> 0`
- jednotka povinna
- `cookingCount >= 0`

### 12.3 Fotka

Pravidla:
- nepovinna
- uklada se lokalni cesta
- pri zmene fotky se stara cesta muze smazat, pokud uz neni pouzita

## 13. STRUKTURA PROJEKTU

Doporucena struktura:

```text
lib/
  app/
    app.dart
    router.dart
    theme/
  core/
    constants/
    extensions/
    utils/
  data/
    db/
    models/
    repositories/
    seed/
  features/
    ingredients/
      application/
      data/
      presentation/
    pantry/
      application/
      presentation/
    recipes/
      application/
      data/
      presentation/
  shared/
    widgets/
    dialogs/
assets/
  seeds/
docs/
```

## 14. DOPORUCENY TECHNOLOGICKY STACK

Zaklad:
- Flutter
- Material 3
- Riverpod
- Isar
- image_picker

Zamerne nevolit v prvni verzi:
- backend
- auth
- cloud sync
- komplikovany state machine framework

## 15. IMPLEMENTACNI FAZE

### Faze 0: Zakladni bootstrap

Cil:
- pripravit projekt pro realnou implementaci

Kroky:
1. opravit defaultni template a nahradit ho vlastni app shell strukturou
2. pridat zavislosti do `pubspec.yaml`
3. zalozit slozky podle navrzene struktury
4. nastavit tema aplikace a title `Recepty Terinky`
5. pridat iOS permission string pro galerii

Akceptace:
- aplikace se spusti
- zobrazi `RecipesScreen` jako prvni screen
- analyza a testy prochazi

### Faze 1: Datovy model a databaze

Kroky:
1. definovat Isar entity
2. vygenerovat schemata
3. vytvorit DB provider
4. vytvorit repositories pro ingredients, recipes, pantry selection, settings
5. napsat helper pro normalizaci textu

Akceptace:
- lze ulozit a nacist ingredienci
- lze ulozit a nacist recept se seznamem receptovych polozek
- lze ulozit a nacist pantry selection

### Faze 2: Seed defaultnich ingredienci

Kroky:
1. pripravit 300+ ceskych ingredienci v JSON
2. pridat asset registraci do `pubspec.yaml`
3. vytvorit startup seed service
4. implementovat seed version check
5. otestovat, ze seed probiha jen jednou

Akceptace:
- po prvnim spusteni je seznam ingredienci naplnen
- po druhem spusteni nedojde k duplikaci

### Faze 3: Screen ingredienci

Kroky:
1. vytvorit `IngredientsScreen`
2. implementovat vyhledavani
3. implementovat filtr `Vse` / `Oblibene`
4. implementovat sekce podle pismen
5. vytvorit pridani ingredience
6. vytvorit edit ingredience
7. vytvorit mazani ingredience s potvrzenim
8. vytvorit favorite toggle

Akceptace:
- seznam je abecedni
- pismenove sekce se zobrazuji
- filtr oblibenych funguje
- CRUD funguje bez restartu

### Faze 4: Vyber ingredienci "mam doma"

Kroky:
1. vytvorit `PantrySelectorScreen`
2. sdilet list komponent s ingredients feature
3. implementovat multi-select
4. ulozit selection do DB
5. pridat tlacitko na vycisteni vyberu
6. pridat filtr oblibenych i zde

Akceptace:
- uzivatel umi vybrat dostupne ingredience
- selection se zachova po restartu

### Faze 5: CRUD receptu

Kroky:
1. vytvorit `RecipeFormScreen`
2. pole pro nazev, popis, fotku
3. dynamicky seznam receptovych ingredienci
4. picker ingredience
5. mnozstvi + jednotka
6. validace formulare
7. edit existujiciho receptu
8. smazani receptu

Akceptace:
- lze vytvorit recept
- lze recept otevrit a upravit
- recept se po ulozeni vrati do seznamu

### Faze 6: Detail receptu

Kroky:
1. vytvorit `RecipeDetailScreen`
2. zobrazit fotku, nazev, popis, ingredience, cooking count
3. pridat `+ uvareno`
4. pridat `Upravit pocet`
5. pridat `Upravit`
6. pridat `Smazat`

Akceptace:
- detail presne odpovida ulozenym datum
- pocet vareni lze zvysovat i rucne opravovat

### Faze 7: Receptovy seznam a matching

Kroky:
1. vytvorit `RecipesScreen`
2. nacitat recepty z DB
3. implementovat vyhledavani podle nazvu a ingredienci
4. implementovat segmented control `Cele` / `Castecne`
5. napojit pantry selection
6. dopocitat `missingIngredients`
7. zobrazit cerveny radek chybejicich ingredienci v partial modu
8. zachovat abecedni razeni

Akceptace:
- `Cele` vraci pouze plne shodne recepty
- `Castecne` vraci recepty s alespon jednou shodou
- chybejici ingredience se zobrazuji spravne

### Faze 8: UX polish

Kroky:
1. prazdne stavy
2. snackbary po ulozeni/smazani
3. potvrzovaci dialogy
4. placeholdery pro fotku
5. drobne animace a vyladeni spacingu
6. ladeni theme a branding prvku

Akceptace:
- aplikace nepusobi jako defaultni template
- chyby a prazdne stavy jsou srozumitelne

### Faze 9: Testy

Minimalni testy:
- normalizace textu
- seed import bez duplikace
- ingredient unique validation
- recipe form validation
- full matching
- partial matching
- vypocet chybejicich ingredienci
- cooking count increment a manual correction

Doporucene widget testy:
- IngredientsScreen filtr oblibenych
- RecipesScreen prepinani modu
- RecipeForm pridani receptove ingredience

### Faze 10: iOS priprava

Kroky:
1. doplnit `NSPhotoLibraryUsageDescription`
2. zkontrolovat image picker flow na iOS
3. pripravit app icons a launch assets
4. nastavit display name pro iOS
5. otestovat Codemagic build

Akceptace:
- iOS build projde v Codemagicu
- instalace pres TestFlight funguje

## 16. PRIORITIZACE IMPLEMENTACE

Nejkratsi cesta k prvnimu pouzitelnemu MVP:
1. bootstrap + navigace
2. DB + seed ingredience
3. ingredients CRUD
4. recipe CRUD
5. recipe list matching
6. detail receptu + cooking count
7. polish + testy

## 17. OTEVRENA PRODUKTOVA ROZHODNUTI, KTERA JSEM UZ ZA TEBE UZAVREL

Aby slo implementovat bez dalsiho zdrzovani, tento plan pocita s temi rozhodnutimi:
- prvni screen je `Recepty`
- domaci ingredience jsou samostatny persistovany vyber, ne favorit
- pri prazdnem vyberu domacich ingredienci se zobrazuji vsechny recepty
- matching ignoruje mnozstvi
- receptove ingredience ukladaji snapshot nazvu kvuli bezpecnemu mazani master ingredienci
- `Pocet vareni` lze jak inkrementovat, tak rucne upravit

## 18. DEFINICE HOTOVE VERZE V1

Verze V1 je hotova, pokud:
- aplikace startuje na seznamu receptu
- existuje seed 300+ defaultnich ingredienci
- ingredience jdou hledat, filtrovat, pridavat, upravovat, mazat a oznacovat jako oblibene
- recepty jdou pridavat, upravovat, mazat a zobrazovat v detailu
- recept obsahuje nazev, fotku, popis, ingredience, mnozstvi, jednotky a pocet vareni
- list receptu podporuje `Cele` a `Castecne`
- v partial modu jsou chybejici ingredience cervene v preview
- aplikace je pripravená na iOS build v Codemagicu
