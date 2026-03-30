import defaultIngredients from "../assets/seeds/default_ingredients_v1.json";

export const STORAGE_KEY = "recepty-terinky.next.v1";
export const SEED_VERSION = 1;

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
};

export type AppState = {
  seedVersion: number;
  ingredients: Ingredient[];
  recipes: Recipe[];
  pantrySelection: number[];
  themeMode: ThemeModeOption;
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
    };

    return ensureSeedData(nextState);
  } catch {
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
