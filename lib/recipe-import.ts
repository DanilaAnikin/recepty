import { INGREDIENT_UNITS, normalizeText, type IngredientUnit } from "./domain";

/**
 * Import receptů z cizích zdrojů.
 *
 * Dvě cesty:
 * 1. `parseRecipeFromHtml` — vytáhne `schema.org/Recipe` z JSON-LD, které má
 *    drtivá většina food blogů kvůli Googlu. Tohle je hlavní cesta.
 * 2. `parseRecipeFromText` — heuristika nad textem nakopírovaným odkudkoli
 *    (zpráva od kamarádky, PDF, fotka přepsaná ručně).
 *
 * Obě funkce jsou čisté a bez DOM/sítě, takže jdou testovat i spustit na serveru.
 */

export type ImportedIngredient = {
  name: string;
  amount: string;
  unit: IngredientUnit;
};

export type ImportedRecipe = {
  title: string;
  description: string;
  steps: string[];
  ingredients: ImportedIngredient[];
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  tags: string[];
  imageUrls: string[];
  sourceUrl?: string;
};

// ---------------------------------------------------------------------------
// Jednotky
// ---------------------------------------------------------------------------

/**
 * Synonyma jednotek včetně českého skloňování. Pořadí je významné —
 * delší tvary musí předcházet kratší, aby "lžičky" nesežral zápis pro "l".
 */
const UNIT_SYNONYMS: Array<{ unit: IngredientUnit; forms: string[] }> = [
  { unit: "lzicka", forms: ["lžičky", "lžičku", "lžiček", "lžičkách", "lžička", "lzicka", "lzicky", "čl", "tsp"] },
  { unit: "lzice", forms: ["lžících", "lžíce", "lžíci", "lžic", "lzice", "lzic", "pl", "tbsp"] },
  { unit: "kg", forms: ["kilogramů", "kilogramy", "kilogram", "kilo", "kg"] },
  { unit: "g", forms: ["gramů", "gramy", "gramu", "gram", "gr", "g"] },
  { unit: "ml", forms: ["mililitrů", "mililitry", "mililitr", "ml"] },
  { unit: "l", forms: ["litrů", "litry", "litru", "litr", "l"] },
  { unit: "par", forms: ["páry", "pár", "par"] },
  { unit: "ks", forms: ["kusů", "kusy", "kusu", "kus", "ks"] },
];

/** Unicode zlomky, které se v receptech běžně objevují. */
const FRACTION_MAP: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅙": "1/6",
  "⅛": "1/8",
};

function expandFractions(text: string): string {
  let result = text;
  for (const [glyph, replacement] of Object.entries(FRACTION_MAP)) {
    // "1½" znamená "1 1/2" — mezera před zlomkem se doplní, aby se nesloučil
    // s předchozím číslem do nesmyslu "11/2".
    result = result.replace(new RegExp(`(\\d)\\s*${glyph}`, "g"), `$1 ${replacement}`);
    result = result.split(glyph).join(replacement);
  }
  return result;
}

function matchUnit(token: string): IngredientUnit | null {
  const normalized = normalizeText(token).replace(/\.$/, "");
  if (normalized.length === 0) {
    return null;
  }
  for (const entry of UNIT_SYNONYMS) {
    if (entry.forms.some((form) => normalizeText(form) === normalized)) {
      return entry.unit;
    }
  }
  // Fallback na kanonické hodnoty z domény ("ks", "g", ...).
  const direct = INGREDIENT_UNITS.find((item) => normalizeText(item.value) === normalized);
  return direct ? direct.value : null;
}

/**
 * Rozebere jeden řádek ingredience na množství, jednotku a název.
 *
 * "200 g hladké mouky"   -> { amount: "200", unit: "g",  name: "hladké mouky" }
 * "2 lžíce olivového oleje" -> { amount: "2", unit: "lzice", name: "olivového oleje" }
 * "špetka soli"          -> { amount: "",    unit: "ks", name: "špetka soli" }
 *
 * Když množství chybí, zůstane prázdné a celý text jde do názvu — je lepší
 * mít "špetka soli" jako název než vymýšlet číslo, které v receptu nebylo.
 */
export function parseIngredientLine(rawLine: string): ImportedIngredient | null {
  const line = expandFractions(rawLine)
    .replace(/\s+/g, " ")
    .replace(/^[-–—•*·]\s*/, "")
    .trim();

  if (line.length === 0) {
    return null;
  }

  const quantityMatch = line.match(
    /^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?(?:\s+\d+\s*\/\s*\d+)?)\s*(.*)$/,
  );

  if (!quantityMatch) {
    return { name: line, amount: "", unit: "ks" };
  }

  const amount = quantityMatch[1].replace(/\s*\/\s*/, "/").trim();
  const rest = quantityMatch[2].trim();

  if (rest.length === 0) {
    return { name: line, amount: "", unit: "ks" };
  }

  const restTokens = rest.split(" ");
  const unit = matchUnit(restTokens[0]);

  if (unit !== null && restTokens.length > 1) {
    return {
      name: restTokens.slice(1).join(" ").trim(),
      amount,
      unit,
    };
  }

  // Bez rozpoznané jednotky: "3 vejce" => 3 ks vajec.
  return { name: rest, amount, unit: "ks" };
}

// ---------------------------------------------------------------------------
// ISO 8601 doba trvání
// ---------------------------------------------------------------------------

/** "PT1H30M" -> 90. Vrací `undefined`, když text není platná doba. */
export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) {
    // Některé weby píšou rovnou "30 min" místo ISO tvaru.
    const plain = value.match(/(\d+)\s*(min|minut|hod|h)/i);
    if (plain) {
      const amount = Number.parseInt(plain[1], 10);
      return /h/i.test(plain[2]) ? amount * 60 : amount;
    }
    return undefined;
  }

  const days = Number.parseInt(match[1] ?? "0", 10);
  const hours = Number.parseInt(match[2] ?? "0", 10);
  const minutes = Number.parseInt(match[3] ?? "0", 10);
  const total = days * 24 * 60 + hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

/** "4 porce", "4-6 servings", 4 -> 4. */
export function parseServings(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseServings(item);
      if (parsed !== undefined) {
        return parsed;
      }
    }
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const match = value.match(/\d+/);
  if (!match) {
    return undefined;
  }
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

type JsonValue = unknown;

function typeIncludesRecipe(value: JsonValue): boolean {
  if (typeof value === "string") {
    return value.toLowerCase().includes("recipe");
  }
  if (Array.isArray(value)) {
    return value.some(typeIncludesRecipe);
  }
  return false;
}

/** Projde libovolně zanořený JSON-LD a vrátí první uzel typu Recipe. */
function findRecipeNode(node: JsonValue, depth = 0): Record<string, JsonValue> | null {
  if (depth > 8 || node === null || typeof node !== "object") {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = node as Record<string, JsonValue>;
  if (typeIncludesRecipe(record["@type"])) {
    return record;
  }

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement"]) {
    const found = findRecipeNode(record[key], depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

/** Odstraní HTML značky a dekóduje základní entity — JSON-LD je občas obsahuje. */
export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function toStringValue(value: JsonValue): string {
  if (typeof value === "string") {
    return stripHtml(value);
  }
  if (typeof value === "number") {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.map(toStringValue).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, JsonValue>;
    // ImageObject / Person / HowToStep mají užitečnou hodnotu pod name/url/text.
    for (const key of ["text", "name", "url", "@id"]) {
      if (typeof record[key] === "string") {
        return stripHtml(record[key] as string);
      }
    }
  }
  return "";
}

function toStringArray(value: JsonValue): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(toStringArray);
  }
  if (typeof value === "string") {
    // "vegetariánské, rychlé" — klíčová slova bývají v jednom řetězci.
    return value
      .split(",")
      .map((part) => stripHtml(part))
      .filter((part) => part.length > 0);
  }
  const single = toStringValue(value);
  return single.length > 0 ? [single] : [];
}

/** Rozbalí `recipeInstructions` ze všech tvarů, které schema.org připouští. */
function extractSteps(value: JsonValue, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    return stripHtml(value)
      .split(/\n+/)
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractSteps(item, depth + 1));
  }

  if (typeof value === "object") {
    const record = value as Record<string, JsonValue>;
    // HowToSection obaluje další kroky.
    if (record.itemListElement !== undefined) {
      return extractSteps(record.itemListElement, depth + 1);
    }
    const text = typeof record.text === "string" ? record.text : record.name;
    return extractSteps(text ?? null, depth + 1);
  }

  return [];
}

function extractImages(value: JsonValue): string[] {
  return toStringArray(value)
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

/** Převede uzel JSON-LD typu Recipe na náš tvar. */
export function recipeFromJsonLd(node: Record<string, unknown>, sourceUrl?: string): ImportedRecipe | null {
  const title = toStringValue(node.name);
  if (title.length === 0) {
    return null;
  }

  const ingredients = toStringArray(node.recipeIngredient ?? node.ingredients)
    .map(parseIngredientLine)
    .filter((item): item is ImportedIngredient => item !== null && item.name.length > 0);

  const totalTime = parseIsoDuration(node.totalTime);
  const prepTime = parseIsoDuration(node.prepTime);
  const cookTime = parseIsoDuration(node.cookTime);

  const tags = [
    ...toStringArray(node.keywords),
    ...toStringArray(node.recipeCategory),
    ...toStringArray(node.recipeCuisine),
  ]
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && tag.length <= 30);

  return {
    title,
    description: toStringValue(node.description),
    steps: extractSteps(node.recipeInstructions),
    ingredients,
    servings: parseServings(node.recipeYield),
    prepTimeMinutes: prepTime,
    // Když web uvádí jen totalTime, dáme ho do "vaření" — celkový čas tak sedí
    // a uživatel si to případně přerozdělí sám.
    cookTimeMinutes: cookTime ?? (prepTime === undefined ? totalTime : undefined),
    tags: [...new Set(tags.map((tag) => tag.toLowerCase()))],
    imageUrls: extractImages(node.image).slice(0, 4),
    sourceUrl,
  };
}

const JSON_LD_PATTERN = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Vytáhne recept z HTML stránky přes JSON-LD.
 * Vrací `null`, když stránka žádný strojově čitelný recept nemá — pak je
 * na řadě ruční vložení textu.
 */
export function parseRecipeFromHtml(html: string, sourceUrl?: string): ImportedRecipe | null {
  JSON_LD_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = JSON_LD_PATTERN.exec(html)) !== null) {
    const raw = match[1].trim();
    if (raw.length === 0) {
      continue;
    }

    let parsed: JsonValue;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Jeden rozbitý blok neznamená, že další nebude v pořádku.
      continue;
    }

    const node = findRecipeNode(parsed);
    if (node) {
      const recipe = recipeFromJsonLd(node, sourceUrl);
      if (recipe) {
        return recipe;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Vložený text
// ---------------------------------------------------------------------------

const INGREDIENT_HEADINGS = ["ingredience", "suroviny", "budeme potrebovat", "potrebujeme", "na testo"];
const STEP_HEADINGS = ["postup", "priprava", "navod", "jak na to", "postup pripravy"];

/** Vypadá řádek jako položka ingredience (číslo + jednotka, nebo odrážka)? */
function looksLikeIngredient(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 90) {
    return false;
  }
  if (/^[-–—•*·]/.test(trimmed)) {
    return true;
  }
  const parsed = parseIngredientLine(trimmed);
  if (!parsed) {
    return false;
  }
  // Množství na začátku je nejsilnější signál. Samotná krátká fráze bez čísla
  // by mohla být i nadpis, tak se na ni nespoléháme.
  return parsed.amount.length > 0;
}

/**
 * Rozebere volně vložený text receptu.
 *
 * Nejdřív se hledají nadpisy ("Ingredience:", "Postup:"), protože ty jsou
 * spolehlivé. Když v textu nejsou, rozhoduje tvar řádku: krátké řádky
 * s množstvím jsou ingredience, delší věty jsou kroky.
 */
export function parseRecipeFromText(text: string, sourceUrl?: string): ImportedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return emptyImportedRecipe(sourceUrl);
  }

  const title = lines[0].replace(/^#+\s*/, "").trim();
  const body = lines.slice(1);

  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let section: "unknown" | "ingredients" | "steps" = "unknown";

  for (const line of body) {
    const heading = normalizeText(line.replace(/[:：]\s*$/, ""));

    if (INGREDIENT_HEADINGS.includes(heading)) {
      section = "ingredients";
      continue;
    }
    if (STEP_HEADINGS.includes(heading)) {
      section = "steps";
      continue;
    }

    if (section === "ingredients") {
      ingredientLines.push(line);
      continue;
    }
    if (section === "steps") {
      stepLines.push(line.replace(/^\s*\d+[.)]\s*/, "").trim());
      continue;
    }

    // Bez nadpisů rozhoduje tvar řádku.
    if (looksLikeIngredient(line)) {
      ingredientLines.push(line);
    } else {
      stepLines.push(line.replace(/^\s*\d+[.)]\s*/, "").trim());
    }
  }

  const ingredients = ingredientLines
    .map(parseIngredientLine)
    .filter((item): item is ImportedIngredient => item !== null && item.name.length > 0);

  return {
    title,
    description: "",
    steps: stepLines.filter((line) => line.length > 0),
    ingredients,
    tags: [],
    imageUrls: [],
    sourceUrl,
  };
}

function emptyImportedRecipe(sourceUrl?: string): ImportedRecipe {
  return {
    title: "",
    description: "",
    steps: [],
    ingredients: [],
    tags: [],
    imageUrls: [],
    sourceUrl,
  };
}
