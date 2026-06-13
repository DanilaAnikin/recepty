import defaultIngredients from "../assets/seeds/default_ingredients_v1.json";

export const STORAGE_KEY = "recepty-terinky.next.v1";
export const BACKUP_KEY = "recepty-terinky.next.v1.corrupt-backup";
export const SEED_VERSION = 1;

export const RECIPE_SORT_MODES = [
  { value: "alphabetical", label: "Abecedně" },
  { value: "mostCooked", label: "Nejvařenější" },
  { value: "recentlyUpdated", label: "Naposledy upravené" },
  { value: "favoritesFirst", label: "Oblíbené" },
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
};

export type AppState = {
  seedVersion: number;
  ingredients: Ingredient[];
  recipes: Recipe[];
  pantrySelection: number[];
  themeMode: ThemeModeOption;
  recipeSortMode: RecipeSortMode;
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

export function createInitialState(): AppState {
  return {
    seedVersion: SEED_VERSION,
    ingredients: seedIngredients(),
    recipes: [],
    pantrySelection: [],
    themeMode: "system",
    recipeSortMode: "alphabetical",
  };
}

export function ensureSeedData(state: AppState): AppState {
  const existingNormalizedNames = new Set(state.ingredients.map((item) => item.normalizedName));
  const missingSeedNames = (defaultIngredients as string[]).filter((item) => {
    return !existingNormalizedNames.has(normalizeText(item));
  });

  if (missingSeedNames.length === 0 && state.seedVersion >= SEED_VERSION) {
    return {
      ...state,
      ingredients: sortIngredients(state.ingredients),
      recipes: sortRecipes(state.recipes),
      pantrySelection: [...state.pantrySelection].sort((left, right) => left - right),
    };
  }

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

  return {
    ...state,
    seedVersion: SEED_VERSION,
    ingredients: sortIngredients([...state.ingredients, ...seededIngredients]),
    recipes: sortRecipes(state.recipes),
    pantrySelection: [...state.pantrySelection].sort((left, right) => left - right),
  };
}

export function parseStoredState(raw: string | null): AppState {
  if (!raw) {
    return createInitialState();
  }

  try {
    const decoded = JSON.parse(raw) as Partial<AppState> | null;
    if (!decoded) {
      return createInitialState();
    }

    const ingredients = Array.isArray(decoded.ingredients)
      ? decoded.ingredients
          .filter(isIngredient)
          .map((item) => ({
            ...item,
            normalizedName: normalizeText(item.name),
            firstLetter: firstLetter(item.name),
          }))
      : [];

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
        }))
      : [];

    const pantrySelection = Array.isArray(decoded.pantrySelection)
      ? decoded.pantrySelection.filter((item): item is number => typeof item === "number")
      : [];

    const nextState: AppState = {
      seedVersion: typeof decoded.seedVersion === "number" ? decoded.seedVersion : 0,
      ingredients,
      recipes,
      pantrySelection,
      themeMode: isThemeModeOption(decoded.themeMode) ? decoded.themeMode : "system",
      recipeSortMode: isRecipeSortMode(decoded.recipeSortMode)
        ? decoded.recipeSortMode
        : "alphabetical",
    };

    return ensureSeedData(nextState);
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
