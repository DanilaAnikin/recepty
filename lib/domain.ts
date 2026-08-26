import defaultIngredients from "../assets/seeds/default_ingredients_v1.json";
import defaultRecipes from "../assets/seeds/default_recipes_v1.json";
import { migrateState, SCHEMA_VERSION, type UnknownState } from "./migrations";

export const STORAGE_KEY = "recepty-terinky.next.v1";
export const BACKUP_KEY = "recepty-terinky.next.v1.corrupt-backup";
export const SEED_VERSION = 1;
export const RECIPE_SEED_VERSION = 1;

export { SCHEMA_VERSION };

export type RecipeSeed = {
  title: string;
  description: string;
  steps: string[];
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  tags: string[];
  ingredients: { name: string; amount: string; unit: IngredientUnit }[];
  imageUrls: string[];
};

export const RECIPE_SORT_MODES = [
  { value: "alphabetical", label: "Abecedně" },
  { value: "mostCooked", label: "Nejvařenější" },
  { value: "recentlyUpdated", label: "Naposledy upravené" },
  { value: "favoritesFirst", label: "Oblíbené" },
  { value: "leastMissing", label: "Nejmíň chybí" },
  { value: "bestRated", label: "Nejlíp hodnocené" },
  { value: "recentlyCooked", label: "Naposledy vařené" },
] as const;

export type RecipeSortMode = (typeof RECIPE_SORT_MODES)[number]["value"];

export const INGREDIENT_UNITS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
  { value: "ks", label: "ks" },
  { value: "par", label: "pár" },
  { value: "lzicka", label: "lžička" },
  { value: "lzice", label: "lžíce" },
] as const;

export const RECIPE_MATCH_MODES = [
  { value: "full", label: "Celé" },
  { value: "partial", label: "Částečné" },
] as const;

export type ThemeModeOption = "system" | "light" | "dark";
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number]["value"];
export type RecipeMatchMode = (typeof RECIPE_MATCH_MODES)[number]["value"];

export type Ingredient = {
  id: number;
  normalizedName: string;
  name: string;
  firstLetter: string;
  isFavorite: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = {
  ingredientId: number | null;
  ingredientNameSnapshot: string;
  normalizedIngredientName: string;
  amountText: string;
  unit: IngredientUnit;
};

/** Jeden záznam v historii vaření — kdy, na kolik porcí, jak dopadlo. */
export type CookLogEntry = {
  id: number;
  cookedAt: string;
  servings?: number;
  rating?: number;
  note?: string;
};

export type Recipe = {
  id: number;
  normalizedTitle: string;
  title: string;
  description: string;
  imagePath: string | null;
  cookingCount: number;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredient[];
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  isFavorite?: boolean;
  tags?: string[];
  steps?: string[];
  imageUrls?: string[];
  /** Klíče fotek uložených jako Blob v IndexedDB (novější než `imagePath`). */
  imageKeys?: string[];
  /** Trvalá poznámka k receptu ("příště míň soli"). */
  notes?: string;
  /** Hodnocení 1–5; odvozené z posledního záznamu v `cookLog`, nebo ruční. */
  rating?: number;
  /** Historie vaření. `cookingCount` zůstává jako rychlý souhrn. */
  cookLog?: CookLogEntry[];
  /** Odkud byl recept naimportován. */
  sourceUrl?: string;
};

/** Položka domácích zásob — na rozdíl od starého `number[]` nese i množství a expiraci. */
export type PantryItem = {
  ingredientId: number;
  quantity?: string;
  unit?: IngredientUnit;
  /** Datum spotřeby ve tvaru YYYY-MM-DD. */
  expiresAt?: string;
  updatedAt: string;
};

export const MEAL_SLOTS = [
  { value: "breakfast", label: "Snídaně" },
  { value: "lunch", label: "Oběd" },
  { value: "dinner", label: "Večeře" },
  { value: "snack", label: "Svačina" },
] as const;

export type MealSlot = (typeof MEAL_SLOTS)[number]["value"];

/** Jeden slot v týdenním plánovači. */
export type MealPlanEntry = {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  slot: MealSlot;
  recipeId: number | null;
  customTitle?: string;
  servings?: number;
};

export type ShoppingItemSource = "manual" | "recipe" | "plan";

/** Položka nákupního seznamu. */
export type ShoppingItem = {
  id: number;
  name: string;
  normalizedName: string;
  ingredientId: number | null;
  amountText: string;
  unit: IngredientUnit | null;
  checked: boolean;
  source: ShoppingItemSource;
  /** Ze kterých receptů položka pochází — kvůli zobrazení původu. */
  recipeTitles?: string[];
  createdAt: string;
};

/** Nastavení volitelné synchronizace na vlastní server. */
export type SyncSettings = {
  enabled: boolean;
  endpoint: string;
  token: string;
  lastSyncedAt: string | null;
  lastSyncedRevision: number;
};

export type AppState = {
  schemaVersion: number;
  seedVersion: number;
  recipeSeedVersion: number;
  ingredients: Ingredient[];
  recipes: Recipe[];
  pantry: PantryItem[];
  mealPlan: MealPlanEntry[];
  shoppingList: ShoppingItem[];
  themeMode: ThemeModeOption;
  recipeSortMode: RecipeSortMode;
  sync: SyncSettings;
  /** Monotónně rostoucí číslo revize — slouží k detekci konfliktů při syncu. */
  revision: number;
  updatedAt: string;
  /** Kdy naposledy proběhla ruční záloha (kvůli připomínce). */
  lastBackupAt: string | null;
};

export type RecipeMatchResult = {
  matches: boolean;
  missingIngredients: string[];
};

const collator = new Intl.Collator("cs", { sensitivity: "base" });

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function prettifyIngredientName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function firstLetter(value: string): string {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? "#" : normalized.charAt(0).toUpperCase();
}

export function sortIngredients(items: Ingredient[]): Ingredient[] {
  return [...items].sort((left, right) => {
    return collator.compare(left.normalizedName, right.normalizedName);
  });
}

export function sortRecipes(items: Recipe[]): Recipe[] {
  return [...items].sort((left, right) => {
    const titleCompare = collator.compare(left.normalizedTitle, right.normalizedTitle);
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function sortRecipesBy(items: Recipe[], mode: RecipeSortMode): Recipe[] {
  const alphabetical = sortRecipes(items);

  switch (mode) {
    case "mostCooked":
      return [...alphabetical].sort((left, right) => {
        const countCompare = right.cookingCount - left.cookingCount;
        if (countCompare !== 0) {
          return countCompare;
        }
        return collator.compare(left.normalizedTitle, right.normalizedTitle);
      });
    case "recentlyUpdated":
      return [...alphabetical].sort((left, right) => {
        return right.updatedAt.localeCompare(left.updatedAt);
      });
    case "favoritesFirst":
      return [...alphabetical].sort((left, right) => {
        const leftFavorite = left.isFavorite === true ? 0 : 1;
        const rightFavorite = right.isFavorite === true ? 0 : 1;
        if (leftFavorite !== rightFavorite) {
          return leftFavorite - rightFavorite;
        }
        return collator.compare(left.normalizedTitle, right.normalizedTitle);
      });
    case "bestRated":
      return [...alphabetical].sort((left, right) => {
        // Nehodnocené recepty patří až za hodnocené, ne mezi ně s nulou.
        const leftRating = averageRating(left);
        const rightRating = averageRating(right);
        if (leftRating === null && rightRating === null) {
          return collator.compare(left.normalizedTitle, right.normalizedTitle);
        }
        if (leftRating === null) {
          return 1;
        }
        if (rightRating === null) {
          return -1;
        }
        if (rightRating !== leftRating) {
          return rightRating - leftRating;
        }
        return collator.compare(left.normalizedTitle, right.normalizedTitle);
      });
    case "recentlyCooked":
      return [...alphabetical].sort((left, right) => {
        const leftCooked = lastCookedAt(left);
        const rightCooked = lastCookedAt(right);
        if (leftCooked === null && rightCooked === null) {
          return collator.compare(left.normalizedTitle, right.normalizedTitle);
        }
        if (leftCooked === null) {
          return 1;
        }
        if (rightCooked === null) {
          return -1;
        }
        return rightCooked.localeCompare(leftCooked);
      });
    // "leastMissing" potřebuje výsledky párování se spíží, které tu nejsou —
    // řadí se až v `lib/filters.ts`, kde je k dispozici `RecipeMatchResult`.
    case "leastMissing":
    case "alphabetical":
    default:
      return alphabetical;
  }
}

export function scaleAmount(amountText: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) {
    return amountText;
  }

  const trimmed = amountText.trim();
  if (trimmed.length === 0) {
    return amountText;
  }

  const formatNumber = (value: number, usesComma: boolean): string => {
    const rounded = Math.round(value * 100) / 100;
    let text = rounded.toFixed(2).replace(/\.?0+$/, "");
    if (usesComma) {
      text = text.replace(".", ",");
    }
    return text;
  };

  const parseNumber = (raw: string): number | null => {
    const normalized = raw.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  };

  // Rozsah: "x-y" nebo "x–y" (pomlčka i en dash).
  const rangeMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([-–])\s*(\d+(?:[.,]\d+)?)$/);
  if (rangeMatch) {
    const leftRaw = rangeMatch[1];
    const separator = rangeMatch[2];
    const rightRaw = rangeMatch[3];
    const leftValue = parseNumber(leftRaw);
    const rightValue = parseNumber(rightRaw);
    if (leftValue !== null && rightValue !== null) {
      const leftComma = leftRaw.includes(",");
      const rightComma = rightRaw.includes(",");
      return `${formatNumber(leftValue * factor, leftComma)}${separator}${formatNumber(
        rightValue * factor,
        rightComma,
      )}`;
    }
    return amountText;
  }

  // Jednoduchý zlomek: "a/b".
  const fractionMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (fractionMatch) {
    const numeratorRaw = fractionMatch[1];
    const denominatorRaw = fractionMatch[2];
    const numerator = parseNumber(numeratorRaw);
    const denominator = parseNumber(denominatorRaw);
    if (numerator !== null && denominator !== null) {
      const numeratorComma = numeratorRaw.includes(",");
      return `${formatNumber(numerator * factor, numeratorComma)}/${denominatorRaw}`;
    }
    return amountText;
  }

  // Čisté číslo (desetinné s tečkou nebo čárkou).
  const single = parseNumber(trimmed);
  if (single !== null) {
    return formatNumber(single * factor, trimmed.includes(","));
  }

  // Cokoli jiného (spetka, dle chuti, písmena) — beze změny.
  return amountText;
}

export function exportStateToJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function getNextId(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0) + 1;
}

export function createSyncSettings(): SyncSettings {
  return {
    enabled: false,
    endpoint: "",
    token: "",
    lastSyncedAt: null,
    lastSyncedRevision: 0,
  };
}

export function createInitialState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    recipeSeedVersion: 0,
    ingredients: seedIngredients(),
    recipes: [],
    pantry: [],
    mealPlan: [],
    shoppingList: [],
    themeMode: "system",
    recipeSortMode: "alphabetical",
    sync: createSyncSettings(),
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    lastBackupAt: null,
  };
}

/** Množina id ingrediencí, které jsou doma — most mezi `pantry` a `evaluateRecipe`. */
export function pantryIdSet(pantry: PantryItem[]): Set<number> {
  return new Set(pantry.map((item) => item.ingredientId));
}

/**
 * Kolik dní zbývá do spotřeby. Záporné číslo = už prošlo, `null` = bez data.
 * Počítá se na celé dny v lokálním čase, aby "dnes" bylo 0 a ne -0.5.
 */
export function daysUntilExpiry(expiresAt: string | undefined, now = new Date()): number | null {
  if (!expiresAt) {
    return null;
  }
  const match = expiresAt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const target = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ).setHours(0, 0, 0, 0);
  const today = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

/** Zásoby, které do `withinDays` dní propadnou (nebo už propadly), od nejnaléhavější. */
export function expiringPantryItems(
  pantry: PantryItem[],
  withinDays = 3,
  now = new Date(),
): Array<{ item: PantryItem; days: number }> {
  return pantry
    .map((item) => ({ item, days: daysUntilExpiry(item.expiresAt, now) }))
    .filter((entry): entry is { item: PantryItem; days: number } => {
      return entry.days !== null && entry.days <= withinDays;
    })
    .sort((left, right) => left.days - right.days);
}

/** Průměrné hodnocení z historie vaření; `recipe.rating` má přednost. */
export function averageRating(recipe: Recipe): number | null {
  if (typeof recipe.rating === "number" && recipe.rating > 0) {
    return recipe.rating;
  }
  const rated = (recipe.cookLog ?? [])
    .map((entry) => entry.rating)
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (rated.length === 0) {
    return null;
  }
  return rated.reduce((sum, value) => sum + value, 0) / rated.length;
}

/** ISO datum posledního uvaření, nebo `null` když recept ještě nikdy nebyl vařený. */
export function lastCookedAt(recipe: Recipe): string | null {
  const log = recipe.cookLog ?? [];
  if (log.length === 0) {
    return null;
  }
  return log.reduce((latest, entry) => (entry.cookedAt > latest ? entry.cookedAt : latest), log[0].cookedAt);
}

export function ensureSeedData(state: AppState): AppState {
  const existingNormalizedNames = new Set(state.ingredients.map((item) => item.normalizedName));
  const missingSeedNames = (defaultIngredients as string[]).filter((item) => {
    return !existingNormalizedNames.has(normalizeText(item));
  });
  const needRecipeSeed = (state.recipeSeedVersion ?? 0) < RECIPE_SEED_VERSION;

  if (missingSeedNames.length === 0 && state.seedVersion >= SEED_VERSION && !needRecipeSeed) {
    return {
      ...state,
      ingredients: sortIngredients(state.ingredients),
      recipes: sortRecipes(state.recipes),
      pantry: sortPantry(state.pantry),
    };
  }

  // 1) Dolij chybějící seed ingredience.
  let nextId = getNextId(state.ingredients.map((item) => item.id));
  const seededIngredients = missingSeedNames.map((rawName) => {
    const now = new Date().toISOString();
    const ingredient: Ingredient = {
      id: nextId++,
      normalizedName: normalizeText(rawName),
      name: prettifyIngredientName(rawName),
      firstLetter: firstLetter(rawName),
      isFavorite: false,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    };
    return ingredient;
  });
  let ingredients = [...state.ingredients, ...seededIngredients];

  // 2) Dolij defaultní recepty (jednou dle RECIPE_SEED_VERSION, dedup dle názvu).
  //    Chybějící ingredience receptů se zároveň vytvoří v seznamu.
  let recipes = state.recipes;
  if (needRecipeSeed) {
    const applied = applyRecipeSeed(ingredients, recipes);
    ingredients = applied.ingredients;
    recipes = applied.recipes;
  }

  return {
    ...state,
    seedVersion: SEED_VERSION,
    recipeSeedVersion: RECIPE_SEED_VERSION,
    ingredients: sortIngredients(ingredients),
    recipes: sortRecipes(recipes),
    pantry: sortPantry(state.pantry),
  };
}

export function sortPantry(pantry: PantryItem[]): PantryItem[] {
  return [...pantry].sort((left, right) => left.ingredientId - right.ingredientId);
}

function applyRecipeSeed(
  ingredients: Ingredient[],
  recipes: Recipe[],
): { ingredients: Ingredient[]; recipes: Recipe[] } {
  const existingTitles = new Set(recipes.map((recipe) => recipe.normalizedTitle));
  const nextIngredients = [...ingredients];
  const byNormalizedName = new Map(nextIngredients.map((item) => [item.normalizedName, item]));
  let nextIngredientId = getNextId(nextIngredients.map((item) => item.id));
  let nextRecipeId = getNextId(recipes.map((recipe) => recipe.id));
  const now = new Date().toISOString();
  const newRecipes: Recipe[] = [];

  for (const seed of defaultRecipes as RecipeSeed[]) {
    const normalizedTitle = normalizeText(seed.title);
    if (existingTitles.has(normalizedTitle)) {
      continue;
    }
    existingTitles.add(normalizedTitle);

    const embeddedIngredients: RecipeIngredient[] = seed.ingredients.map((seedIngredient) => {
      const normalizedName = normalizeText(seedIngredient.name);
      let ingredient = byNormalizedName.get(normalizedName);
      if (!ingredient) {
        ingredient = {
          id: nextIngredientId++,
          normalizedName,
          name: prettifyIngredientName(seedIngredient.name),
          firstLetter: firstLetter(seedIngredient.name),
          isFavorite: false,
          isSystem: true,
          createdAt: now,
          updatedAt: now,
        };
        byNormalizedName.set(normalizedName, ingredient);
        nextIngredients.push(ingredient);
      }
      return {
        ingredientId: ingredient.id,
        // V receptu zobrazujeme pěkný název s diakritikou ze seedu receptu i
        // tehdy, když se napároval na starší (bez diakritiky) seed ingredienci;
        // párování přes ingredientId zůstává.
        ingredientNameSnapshot: prettifyIngredientName(seedIngredient.name),
        normalizedIngredientName: ingredient.normalizedName,
        amountText: seedIngredient.amount,
        unit: seedIngredient.unit,
      };
    });

    newRecipes.push({
      id: nextRecipeId++,
      title: seed.title,
      normalizedTitle,
      description: seed.description,
      imagePath: null,
      imageUrls: seed.imageUrls,
      steps: seed.steps,
      cookingCount: 0,
      createdAt: now,
      updatedAt: now,
      ingredients: embeddedIngredients,
      servings: seed.servings,
      prepTimeMinutes: seed.prepTimeMinutes,
      cookTimeMinutes: seed.cookTimeMinutes,
      isFavorite: false,
      tags: seed.tags,
    });
  }

  return { ingredients: nextIngredients, recipes: [...recipes, ...newRecipes] };
}

/**
 * Převede libovolně poškozený/starý objekt na platný `AppState`.
 * Používá se jak při načtení z úložiště, tak při importu zálohy a při syncu —
 * kterýkoli z těch vstupů může být cizí a neověřený.
 */
export function normalizeState(input: unknown): AppState {
  const decoded = migrateState(
    (input && typeof input === "object" ? input : {}) as UnknownState,
  ) as Partial<AppState> & UnknownState;

  const ingredients = Array.isArray(decoded.ingredients)
    ? decoded.ingredients.filter(isIngredient).map((item) => ({
        ...item,
        normalizedName: normalizeText(item.name),
        firstLetter: firstLetter(item.name),
      }))
    : [];

  const knownIngredientIds = new Set(ingredients.map((item) => item.id));

  const recipes = Array.isArray(decoded.recipes)
    ? decoded.recipes.filter(isRecipe).map((recipe) => ({
        ...recipe,
        normalizedTitle: normalizeText(recipe.title),
        ingredients: recipe.ingredients.filter(isRecipeIngredient),
        isFavorite: recipe.isFavorite === true,
        tags: Array.isArray(recipe.tags)
          ? recipe.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        servings: typeof recipe.servings === "number" ? recipe.servings : undefined,
        prepTimeMinutes:
          typeof recipe.prepTimeMinutes === "number" ? recipe.prepTimeMinutes : undefined,
        cookTimeMinutes:
          typeof recipe.cookTimeMinutes === "number" ? recipe.cookTimeMinutes : undefined,
        steps: Array.isArray(recipe.steps)
          ? recipe.steps.filter((step): step is string => typeof step === "string")
          : [],
        imageUrls: Array.isArray(recipe.imageUrls)
          ? recipe.imageUrls.filter((url): url is string => typeof url === "string")
          : [],
        imageKeys: Array.isArray(recipe.imageKeys)
          ? recipe.imageKeys.filter((key): key is string => typeof key === "string")
          : [],
        notes: typeof recipe.notes === "string" ? recipe.notes : undefined,
        rating: isRating(recipe.rating) ? recipe.rating : undefined,
        sourceUrl: typeof recipe.sourceUrl === "string" ? recipe.sourceUrl : undefined,
        cookLog: Array.isArray(recipe.cookLog) ? recipe.cookLog.filter(isCookLogEntry) : [],
      }))
    : [];

  // Zásoby smí odkazovat jen na existující ingredience — jinak by ve spíži
  // zůstaly neviditelné položky, které nejde odškrtnout.
  const pantry = Array.isArray(decoded.pantry)
    ? dedupeBy(
        decoded.pantry.filter(isPantryItem).filter((item) => knownIngredientIds.has(item.ingredientId)),
        (item) => item.ingredientId,
      )
    : [];

  const knownRecipeIds = new Set(recipes.map((recipe) => recipe.id));
  const mealPlan = Array.isArray(decoded.mealPlan)
    ? decoded.mealPlan
        .filter(isMealPlanEntry)
        // Smazaný recept nesmí nechat v plánu prázdný odkaz — buď má vlastní
        // název (ručně psané jídlo), nebo se záznam zahodí.
        .filter((entry) => entry.recipeId === null || knownRecipeIds.has(entry.recipeId))
    : [];

  const shoppingList = Array.isArray(decoded.shoppingList)
    ? decoded.shoppingList.filter(isShoppingItem).map((item) => ({
        ...item,
        normalizedName: normalizeText(item.name),
        checked: item.checked === true,
      }))
    : [];

  const nextState: AppState = {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: typeof decoded.seedVersion === "number" ? decoded.seedVersion : 0,
    recipeSeedVersion:
      typeof decoded.recipeSeedVersion === "number" ? decoded.recipeSeedVersion : 0,
    ingredients,
    recipes,
    pantry,
    mealPlan,
    shoppingList,
    themeMode: isThemeModeOption(decoded.themeMode) ? decoded.themeMode : "system",
    recipeSortMode: isRecipeSortMode(decoded.recipeSortMode)
      ? decoded.recipeSortMode
      : "alphabetical",
    sync: normalizeSyncSettings(decoded.sync),
    revision:
      typeof decoded.revision === "number" && Number.isFinite(decoded.revision)
        ? Math.max(0, Math.floor(decoded.revision))
        : 0,
    updatedAt:
      typeof decoded.updatedAt === "string" ? decoded.updatedAt : new Date(0).toISOString(),
    lastBackupAt: typeof decoded.lastBackupAt === "string" ? decoded.lastBackupAt : null,
  };

  return ensureSeedData(nextState);
}

export function parseStoredState(raw: string | null): AppState {
  if (!raw) {
    return createInitialState();
  }

  try {
    const decoded = JSON.parse(raw) as unknown;
    if (!decoded || typeof decoded !== "object") {
      return createInitialState();
    }

    return normalizeState(decoded);
  } catch (error) {
    console.error("Recepty Terinky: poškozená data v localStorage", error);
    if (raw && typeof window !== "undefined") {
      try {
        localStorage.setItem(BACKUP_KEY, raw);
      } catch {
        // Kvóta localStorage může selhat — záloha je best-effort, chybu ignorujeme.
      }
    }
    return createInitialState();
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

export function evaluateRecipe(
  recipe: Recipe,
  selectedIngredientIds: Set<number>,
  query: string,
  mode: RecipeMatchMode,
): RecipeMatchResult {
  const normalizedQuery = normalizeText(query);
  const matchesText =
    normalizedQuery.length === 0 ||
    recipe.normalizedTitle.includes(normalizedQuery) ||
    recipe.ingredients.some((item) => item.normalizedIngredientName.includes(normalizedQuery));

  if (!matchesText) {
    return {
      matches: false,
      missingIngredients: [],
    };
  }

  if (selectedIngredientIds.size === 0) {
    return {
      matches: true,
      missingIngredients: [],
    };
  }

  const missingIngredients: string[] = [];
  let anySelected = false;

  for (const item of recipe.ingredients) {
    const isSelected = item.ingredientId !== null && selectedIngredientIds.has(item.ingredientId);
    if (isSelected) {
      anySelected = true;
    } else {
      missingIngredients.push(item.ingredientNameSnapshot);
    }
  }

  if (mode === "full") {
    return {
      matches: missingIngredients.length === 0,
      missingIngredients,
    };
  }

  return {
    matches: anySelected || recipe.ingredients.length === 0,
    missingIngredients,
  };
}

export function getUnitLabel(unit: IngredientUnit): string {
  return INGREDIENT_UNITS.find((item) => item.value === unit)?.label ?? unit;
}

export function resolveTheme(
  themeMode: ThemeModeOption,
  prefersDark: boolean,
): "light" | "dark" {
  if (themeMode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return themeMode;
}

function seedIngredients(): Ingredient[] {
  let nextId = 1;
  const now = new Date().toISOString();
  return sortIngredients(
    (defaultIngredients as string[]).map((rawName) => ({
      id: nextId++,
      normalizedName: normalizeText(rawName),
      name: prettifyIngredientName(rawName),
      firstLetter: firstLetter(rawName),
      isFavorite: false,
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

function isThemeModeOption(value: unknown): value is ThemeModeOption {
  return value === "system" || value === "light" || value === "dark";
}

function isRecipeSortMode(value: unknown): value is RecipeSortMode {
  return RECIPE_SORT_MODES.some((mode) => mode.value === value);
}

function isIngredient(value: unknown): value is Ingredient {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<Ingredient>;
  return (
    typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isRecipeIngredient(value: unknown): value is RecipeIngredient {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<RecipeIngredient>;
  return (
    typeof item.ingredientNameSnapshot === "string" &&
    typeof item.normalizedIngredientName === "string" &&
    typeof item.amountText === "string" &&
    typeof item.unit === "string"
  );
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<Recipe>;
  return (
    typeof item.id === "number" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.cookingCount === "number" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    Array.isArray(item.ingredients)
  );
}

function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5;
}

function isIngredientUnit(value: unknown): value is IngredientUnit {
  return INGREDIENT_UNITS.some((unit) => unit.value === value);
}

function isCookLogEntry(value: unknown): value is CookLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<CookLogEntry>;
  return typeof item.id === "number" && typeof item.cookedAt === "string";
}

function isPantryItem(value: unknown): value is PantryItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<PantryItem>;
  return (
    typeof item.ingredientId === "number" &&
    (item.unit === undefined || isIngredientUnit(item.unit)) &&
    (item.quantity === undefined || typeof item.quantity === "string") &&
    (item.expiresAt === undefined || typeof item.expiresAt === "string")
  );
}

function isMealPlanEntry(value: unknown): value is MealPlanEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<MealPlanEntry>;
  return (
    typeof item.id === "number" &&
    typeof item.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    MEAL_SLOTS.some((slot) => slot.value === item.slot) &&
    (item.recipeId === null || typeof item.recipeId === "number")
  );
}

function isShoppingItem(value: unknown): value is ShoppingItem {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<ShoppingItem>;
  return (
    typeof item.id === "number" &&
    typeof item.name === "string" &&
    typeof item.amountText === "string" &&
    (item.unit === null || isIngredientUnit(item.unit)) &&
    (item.ingredientId === null || typeof item.ingredientId === "number")
  );
}

function normalizeSyncSettings(value: unknown): SyncSettings {
  const fallback = createSyncSettings();
  if (!value || typeof value !== "object") {
    return fallback;
  }
  const item = value as Partial<SyncSettings>;
  return {
    enabled: item.enabled === true,
    endpoint: typeof item.endpoint === "string" ? item.endpoint : fallback.endpoint,
    token: typeof item.token === "string" ? item.token : fallback.token,
    lastSyncedAt: typeof item.lastSyncedAt === "string" ? item.lastSyncedAt : null,
    lastSyncedRevision:
      typeof item.lastSyncedRevision === "number" && Number.isFinite(item.lastSyncedRevision)
        ? Math.max(0, Math.floor(item.lastSyncedRevision))
        : 0,
  };
}

/** Ponechá první výskyt každého klíče — pořadí vstupu se zachovává. */
function dedupeBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const itemKey = key(item);
    if (seen.has(itemKey)) {
      continue;
    }
    seen.add(itemKey);
    result.push(item);
  }
  return result;
}
