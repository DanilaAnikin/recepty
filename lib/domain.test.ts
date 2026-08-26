import { describe, it, expect } from "vitest";
import defaultIngredients from "../assets/seeds/default_ingredients_v1.json";
import defaultRecipes from "../assets/seeds/default_recipes_v1.json";
import {
  normalizeText,
  prettifyIngredientName,
  firstLetter,
  sortIngredients,
  sortRecipes,
  sortRecipesBy,
  scaleAmount,
  parseStoredState,
  ensureSeedData,
  exportStateToJson,
  evaluateRecipe,
  createInitialState,
  getUnitLabel,
  resolveTheme,
  SEED_VERSION,
  RECIPE_SEED_VERSION,
  SCHEMA_VERSION,
  createSyncSettings,
  type Ingredient,
  type Recipe,
  type RecipeIngredient,
  type AppState,
  type PantryItem,
} from "./domain";

// ---------------------------------------------------------------------------
// Test helpers / factories
// ---------------------------------------------------------------------------

const SEED_NAMES = defaultIngredients as string[];

function makeIngredient(partial: Partial<Ingredient> & { name: string }): Ingredient {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: partial.id ?? 1,
    name: partial.name,
    normalizedName: partial.normalizedName ?? normalizeText(partial.name),
    firstLetter: partial.firstLetter ?? firstLetter(partial.name),
    isFavorite: partial.isFavorite ?? false,
    isSystem: partial.isSystem ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

function makeRecipeIngredient(
  partial: Partial<RecipeIngredient> & { ingredientNameSnapshot: string },
): RecipeIngredient {
  return {
    ingredientId: partial.ingredientId ?? null,
    ingredientNameSnapshot: partial.ingredientNameSnapshot,
    normalizedIngredientName:
      partial.normalizedIngredientName ?? normalizeText(partial.ingredientNameSnapshot),
    amountText: partial.amountText ?? "",
    unit: partial.unit ?? "g",
  };
}

function makeRecipe(partial: Partial<Recipe> & { title: string }): Recipe {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: partial.id ?? 1,
    title: partial.title,
    normalizedTitle: partial.normalizedTitle ?? normalizeText(partial.title),
    description: partial.description ?? "",
    imagePath: partial.imagePath ?? null,
    cookingCount: partial.cookingCount ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    ingredients: partial.ingredients ?? [],
    servings: partial.servings,
    prepTimeMinutes: partial.prepTimeMinutes,
    cookTimeMinutes: partial.cookTimeMinutes,
    isFavorite: partial.isFavorite,
    tags: partial.tags,
  };
}

function makePantryItem(ingredientId: number, partial: Partial<PantryItem> = {}): PantryItem {
  return {
    ingredientId,
    quantity: partial.quantity,
    unit: partial.unit,
    expiresAt: partial.expiresAt,
    updatedAt: partial.updatedAt ?? "2024-01-01T00:00:00.000Z",
  };
}

/** Plný `AppState` s rozumnými výchozími hodnotami — testy přepisují jen to, co zkoumají. */
function makeState(partial: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: partial.schemaVersion ?? SCHEMA_VERSION,
    seedVersion: partial.seedVersion ?? SEED_VERSION,
    recipeSeedVersion: partial.recipeSeedVersion ?? RECIPE_SEED_VERSION,
    ingredients: partial.ingredients ?? [],
    recipes: partial.recipes ?? [],
    pantry: partial.pantry ?? [],
    mealPlan: partial.mealPlan ?? [],
    shoppingList: partial.shoppingList ?? [],
    themeMode: partial.themeMode ?? "system",
    recipeSortMode: partial.recipeSortMode ?? "alphabetical",
    sync: partial.sync ?? createSyncSettings(),
    revision: partial.revision ?? 0,
    updatedAt: partial.updatedAt ?? "2024-01-01T00:00:00.000Z",
    lastBackupAt: partial.lastBackupAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

describe("normalizeText", () => {
  it("removes diacritics (česnek -> cesnek)", () => {
    expect(normalizeText("česnek")).toBe("cesnek");
  });

  it("removes a wide range of Czech diacritics", () => {
    expect(normalizeText("Příliš žluťoučký kůň")).toBe("prilis zlutoucky kun");
  });

  it("lowercases input", () => {
    expect(normalizeText("MOUKA")).toBe("mouka");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeText("   sůl   ")).toBe("sul");
  });

  it("collapses internal whitespace runs into a single space", () => {
    expect(normalizeText("hrubá    mouka")).toBe("hruba mouka");
  });

  it("collapses tabs/newlines as whitespace too", () => {
    expect(normalizeText("a\t\n  b")).toBe("a b");
  });

  it("combines trim, lowercase, diacritics and collapse together", () => {
    expect(normalizeText("  Česnek   ČERVENÝ  ")).toBe("cesnek cerveny");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeText("   ")).toBe("");
    expect(normalizeText("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// prettifyIngredientName
// ---------------------------------------------------------------------------

describe("prettifyIngredientName", () => {
  it("capitalizes the first letter of each token", () => {
    expect(prettifyIngredientName("hrubá mouka")).toBe("Hrubá Mouka");
  });

  it("keeps the remainder of each token unchanged (no lowercasing)", () => {
    expect(prettifyIngredientName("anglicka SLANINA")).toBe("Anglicka SLANINA");
  });

  it("trims and collapses multiple spaces between words", () => {
    expect(prettifyIngredientName("  ananasovy    kompot  ")).toBe("Ananasovy Kompot");
  });

  it("returns empty string for blank input", () => {
    expect(prettifyIngredientName("   ")).toBe("");
    expect(prettifyIngredientName("")).toBe("");
  });

  it("handles a single word", () => {
    expect(prettifyIngredientName("agar")).toBe("Agar");
  });
});

// ---------------------------------------------------------------------------
// firstLetter
// ---------------------------------------------------------------------------

describe("firstLetter", () => {
  it("returns the uppercased first letter of normalized text", () => {
    expect(firstLetter("česnek")).toBe("C");
  });

  it("strips diacritics before taking the first letter", () => {
    expect(firstLetter("Žampion")).toBe("Z");
  });

  it("returns '#' for an empty string", () => {
    expect(firstLetter("")).toBe("#");
  });

  it("returns '#' for whitespace-only input", () => {
    expect(firstLetter("   ")).toBe("#");
  });

  it("ignores leading whitespace and uses the first real character", () => {
    expect(firstLetter("   mouka")).toBe("M");
  });
});

// ---------------------------------------------------------------------------
// evaluateRecipe
// ---------------------------------------------------------------------------

describe("evaluateRecipe", () => {
  const recipe = makeRecipe({
    id: 1,
    title: "Bramboračka",
    ingredients: [
      makeRecipeIngredient({ ingredientId: 10, ingredientNameSnapshot: "Brambory" }),
      makeRecipeIngredient({ ingredientId: 20, ingredientNameSnapshot: "Mrkev" }),
      makeRecipeIngredient({ ingredientId: 30, ingredientNameSnapshot: "Houby" }),
    ],
  });

  it("full mode: matches when all ingredients are in the pantry, no missing", () => {
    const result = evaluateRecipe(recipe, new Set([10, 20, 30]), "", "full");
    expect(result.matches).toBe(true);
    expect(result.missingIngredients).toEqual([]);
  });

  it("full mode: does not match when some ingredient is missing, lists missing", () => {
    const result = evaluateRecipe(recipe, new Set([10, 20]), "", "full");
    expect(result.matches).toBe(false);
    expect(result.missingIngredients).toEqual(["Houby"]);
  });

  it("partial mode: matches when at least one ingredient is present, lists missing", () => {
    const result = evaluateRecipe(recipe, new Set([10]), "", "partial");
    expect(result.matches).toBe(true);
    expect(result.missingIngredients).toEqual(["Mrkev", "Houby"]);
  });

  it("partial mode: does not match when none of the selected ingredients are present", () => {
    const result = evaluateRecipe(recipe, new Set([999]), "", "partial");
    expect(result.matches).toBe(false);
    expect(result.missingIngredients).toEqual(["Brambory", "Mrkev", "Houby"]);
  });

  it("empty selection -> matches everything regardless of mode (no missing)", () => {
    const full = evaluateRecipe(recipe, new Set<number>(), "", "full");
    const partial = evaluateRecipe(recipe, new Set<number>(), "", "partial");
    expect(full.matches).toBe(true);
    expect(full.missingIngredients).toEqual([]);
    expect(partial.matches).toBe(true);
    expect(partial.missingIngredients).toEqual([]);
  });

  it("empty query -> does not restrict by text", () => {
    const result = evaluateRecipe(recipe, new Set([10, 20, 30]), "", "full");
    expect(result.matches).toBe(true);
  });

  it("text filter matches by recipe title (diacritics-insensitive)", () => {
    const result = evaluateRecipe(recipe, new Set<number>(), "bramborACKA", "full");
    expect(result.matches).toBe(true);
  });

  it("text filter matches a partial substring of the title", () => {
    const result = evaluateRecipe(recipe, new Set<number>(), "bramb", "full");
    expect(result.matches).toBe(true);
  });

  it("text filter matches by ingredient name", () => {
    const result = evaluateRecipe(recipe, new Set<number>(), "mrkev", "full");
    expect(result.matches).toBe(true);
  });

  it("text filter rejects when query matches neither title nor any ingredient", () => {
    const result = evaluateRecipe(recipe, new Set([10, 20, 30]), "rajcata", "full");
    expect(result.matches).toBe(false);
    expect(result.missingIngredients).toEqual([]);
  });

  it("text filter is applied before pantry evaluation (non-matching text short-circuits)", () => {
    // Even though pantry would fully match, the text filter rejects first.
    const result = evaluateRecipe(recipe, new Set([10, 20, 30]), "zzz-neexistuje", "partial");
    expect(result.matches).toBe(false);
    expect(result.missingIngredients).toEqual([]);
  });

  it("ingredients with null ingredientId are never considered selected", () => {
    const r = makeRecipe({
      id: 2,
      title: "Test",
      ingredients: [
        makeRecipeIngredient({ ingredientId: null, ingredientNameSnapshot: "Voda" }),
      ],
    });
    const result = evaluateRecipe(r, new Set([1, 2, 3]), "", "full");
    expect(result.matches).toBe(false);
    expect(result.missingIngredients).toEqual(["Voda"]);
  });

  it("partial mode: recipe with no ingredients matches when a selection exists", () => {
    const r = makeRecipe({ id: 3, title: "Prazdny", ingredients: [] });
    const result = evaluateRecipe(r, new Set([1]), "", "partial");
    expect(result.matches).toBe(true);
    expect(result.missingIngredients).toEqual([]);
  });

  it("full mode: recipe with no ingredients matches when a selection exists", () => {
    const r = makeRecipe({ id: 4, title: "Prazdny", ingredients: [] });
    const result = evaluateRecipe(r, new Set([1]), "", "full");
    expect(result.matches).toBe(true);
    expect(result.missingIngredients).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sortIngredients
// ---------------------------------------------------------------------------

describe("sortIngredients", () => {
  it("sorts ingredients alphabetically using the Czech collator", () => {
    const items = [
      makeIngredient({ id: 1, name: "Žampion" }),
      makeIngredient({ id: 2, name: "Cibule" }),
      makeIngredient({ id: 3, name: "Ananas" }),
    ];
    const sorted = sortIngredients(items).map((i) => i.name);
    expect(sorted).toEqual(["Ananas", "Cibule", "Žampion"]);
  });

  it("orders Czech 'ch' digraph after 'h' and before 'i' (collator behaviour)", () => {
    const items = [
      makeIngredient({ id: 1, name: "iglu" }),
      makeIngredient({ id: 2, name: "chleba" }),
      makeIngredient({ id: 3, name: "houby" }),
    ];
    const sorted = sortIngredients(items).map((i) => i.name);
    expect(sorted).toEqual(["houby", "chleba", "iglu"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      makeIngredient({ id: 1, name: "Cibule" }),
      makeIngredient({ id: 2, name: "Ananas" }),
    ];
    const before = items.map((i) => i.name);
    sortIngredients(items);
    expect(items.map((i) => i.name)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// sortRecipes
// ---------------------------------------------------------------------------

describe("sortRecipes", () => {
  it("sorts recipes alphabetically by title using the Czech collator", () => {
    const items = [
      makeRecipe({ id: 1, title: "Štrúdl" }),
      makeRecipe({ id: 2, title: "Bramboračka" }),
      makeRecipe({ id: 3, title: "Čočka" }),
    ];
    const sorted = sortRecipes(items).map((r) => r.title);
    expect(sorted).toEqual(["Bramboračka", "Čočka", "Štrúdl"]);
  });

  it("breaks title ties by most recently updated first", () => {
    const items = [
      makeRecipe({ id: 1, title: "Guláš", updatedAt: "2024-01-01T00:00:00.000Z" }),
      makeRecipe({ id: 2, title: "Guláš", updatedAt: "2024-06-01T00:00:00.000Z" }),
    ];
    const sorted = sortRecipes(items).map((r) => r.id);
    // Newer updatedAt (id 2) should come first.
    expect(sorted).toEqual([2, 1]);
  });

  it("does not mutate the input array", () => {
    const items = [
      makeRecipe({ id: 1, title: "Čočka" }),
      makeRecipe({ id: 2, title: "Bramboračka" }),
    ];
    const before = items.map((r) => r.id);
    sortRecipes(items);
    expect(items.map((r) => r.id)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// sortRecipesBy
// ---------------------------------------------------------------------------

describe("sortRecipesBy", () => {
  it("alphabetical: orders by Czech collator on title", () => {
    const items = [
      makeRecipe({ id: 1, title: "Čočka" }),
      makeRecipe({ id: 2, title: "Ananasový dort" }),
      makeRecipe({ id: 3, title: "Bramboračka" }),
    ];
    const sorted = sortRecipesBy(items, "alphabetical").map((r) => r.title);
    expect(sorted).toEqual(["Ananasový dort", "Bramboračka", "Čočka"]);
  });

  it("mostCooked: orders by cookingCount descending", () => {
    const items = [
      makeRecipe({ id: 1, title: "A", cookingCount: 2 }),
      makeRecipe({ id: 2, title: "B", cookingCount: 10 }),
      makeRecipe({ id: 3, title: "C", cookingCount: 5 }),
    ];
    const sorted = sortRecipesBy(items, "mostCooked").map((r) => r.id);
    expect(sorted).toEqual([2, 3, 1]);
  });

  it("mostCooked: ties are broken alphabetically by title", () => {
    const items = [
      makeRecipe({ id: 1, title: "Cuketa", cookingCount: 5 }),
      makeRecipe({ id: 2, title: "Avokádo", cookingCount: 5 }),
      makeRecipe({ id: 3, title: "Banán", cookingCount: 5 }),
    ];
    const sorted = sortRecipesBy(items, "mostCooked").map((r) => r.title);
    expect(sorted).toEqual(["Avokádo", "Banán", "Cuketa"]);
  });

  it("recentlyUpdated: orders by updatedAt descending", () => {
    const items = [
      makeRecipe({ id: 1, title: "A", updatedAt: "2024-01-01T00:00:00.000Z" }),
      makeRecipe({ id: 2, title: "B", updatedAt: "2024-12-31T00:00:00.000Z" }),
      makeRecipe({ id: 3, title: "C", updatedAt: "2024-06-15T00:00:00.000Z" }),
    ];
    const sorted = sortRecipesBy(items, "recentlyUpdated").map((r) => r.id);
    expect(sorted).toEqual([2, 3, 1]);
  });

  it("favoritesFirst: favorites bubble to the top, alphabetical within each group", () => {
    const items = [
      makeRecipe({ id: 1, title: "Cibulačka", isFavorite: false }),
      makeRecipe({ id: 2, title: "Borůvkový koláč", isFavorite: true }),
      makeRecipe({ id: 3, title: "Ananasový dort", isFavorite: false }),
      makeRecipe({ id: 4, title: "Dýňová polévka", isFavorite: true }),
    ];
    const sorted = sortRecipesBy(items, "favoritesFirst").map((r) => r.title);
    // Favorites first (alphabetical), then non-favorites (alphabetical).
    expect(sorted).toEqual([
      "Borůvkový koláč",
      "Dýňová polévka",
      "Ananasový dort",
      "Cibulačka",
    ]);
  });

  it("favoritesFirst: treats missing/undefined isFavorite as non-favorite", () => {
    const items = [
      makeRecipe({ id: 1, title: "Zeli" }), // isFavorite undefined
      makeRecipe({ id: 2, title: "Avokado", isFavorite: true }),
    ];
    const sorted = sortRecipesBy(items, "favoritesFirst").map((r) => r.id);
    expect(sorted).toEqual([2, 1]);
  });

  it("unknown/default mode falls back to alphabetical", () => {
    const items = [
      makeRecipe({ id: 1, title: "Čočka" }),
      makeRecipe({ id: 2, title: "Bramboračka" }),
    ];
    // Cast through unknown to exercise the default branch.
    const sorted = sortRecipesBy(items, "neexistuje" as unknown as "alphabetical").map(
      (r) => r.title,
    );
    expect(sorted).toEqual(["Bramboračka", "Čočka"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      makeRecipe({ id: 1, title: "A", cookingCount: 1 }),
      makeRecipe({ id: 2, title: "B", cookingCount: 9 }),
    ];
    const before = items.map((r) => r.id);
    sortRecipesBy(items, "mostCooked");
    expect(items.map((r) => r.id)).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// scaleAmount
// ---------------------------------------------------------------------------

describe("scaleAmount", () => {
  it("scales a plain integer ('200' * 2 = '400')", () => {
    expect(scaleAmount("200", 2)).toBe("400");
  });

  it("scales a decimal written with a comma and preserves the comma when fractional", () => {
    expect(scaleAmount("1,5", 3)).toBe("4,5");
  });

  it("scales a decimal written with a comma but drops it when result is integer", () => {
    // 1,5 * 2 = 3 (no fractional part remains, so no comma)
    expect(scaleAmount("1,5", 2)).toBe("3");
  });

  it("scales a decimal written with a dot and preserves the dot", () => {
    expect(scaleAmount("1.5", 3)).toBe("4.5");
  });

  it("scales a dot-decimal to an integer when result is whole", () => {
    expect(scaleAmount("0.5", 2)).toBe("1");
  });

  it("scales a fraction's numerator and keeps the denominator verbatim ('1/2' * 2 = '2/2')", () => {
    expect(scaleAmount("1/2", 2)).toBe("2/2");
  });

  it("scales a fraction numerator producing a non-trivial result ('1/2' * 3 = '3/2')", () => {
    expect(scaleAmount("1/2", 3)).toBe("3/2");
  });

  it("scales both ends of a range ('2-3' * 2 = '4-6')", () => {
    expect(scaleAmount("2-3", 2)).toBe("4-6");
  });

  it("scales a range using an en dash separator and preserves the separator", () => {
    expect(scaleAmount("2–4", 2)).toBe("4–8");
  });

  it("scales a range with comma decimals and preserves commas", () => {
    expect(scaleAmount("1,5-2,5", 2)).toBe("3-5");
  });

  it("rounds to at most 2 decimals", () => {
    // 0.1 * 3 = 0.30000000000000004 -> rounded -> "0.3"
    expect(scaleAmount("0.1", 3)).toBe("0.3");
  });

  it("leaves non-numeric text unchanged ('špetka')", () => {
    expect(scaleAmount("špetka", 2)).toBe("špetka");
  });

  it("leaves descriptive text unchanged ('dle chuti')", () => {
    expect(scaleAmount("dle chuti", 5)).toBe("dle chuti");
  });

  it("returns the original when factor is zero", () => {
    expect(scaleAmount("200", 0)).toBe("200");
  });

  it("returns the original when factor is negative", () => {
    expect(scaleAmount("200", -2)).toBe("200");
  });

  it("returns the original when factor is NaN", () => {
    expect(scaleAmount("200", NaN)).toBe("200");
  });

  it("returns the original when factor is Infinity", () => {
    expect(scaleAmount("200", Infinity)).toBe("200");
  });

  it("returns the original (whitespace) for blank amount text", () => {
    expect(scaleAmount("   ", 2)).toBe("   ");
  });

  it("does not mutate the input string (strings are immutable, output is fresh)", () => {
    const input = "200";
    const output = scaleAmount(input, 2);
    expect(input).toBe("200");
    expect(output).toBe("400");
  });
});

// ---------------------------------------------------------------------------
// parseStoredState
// ---------------------------------------------------------------------------

describe("parseStoredState", () => {
  it("(a) returns the seeded initial state for null input", () => {
    const state = parseStoredState(null);
    expect(state.seedVersion).toBe(SEED_VERSION);
    expect(state.recipes).toEqual([]);
    expect(state.pantry).toEqual([]);
    expect(state.themeMode).toBe("system");
    expect(state.recipeSortMode).toBe("alphabetical");
    // Seeds were applied.
    expect(state.ingredients.length).toBe(SEED_NAMES.length);
  });

  it("(b) returns initial state for invalid JSON without throwing", () => {
    let state: AppState | undefined;
    expect(() => {
      state = parseStoredState("{{");
    }).not.toThrow();
    expect(state).toBeDefined();
    expect(state!.seedVersion).toBe(SEED_VERSION);
    expect(state!.ingredients.length).toBe(SEED_NAMES.length);
  });

  it("(b2) returns initial state for the JSON literal null", () => {
    const state = parseStoredState("null");
    expect(state.seedVersion).toBe(SEED_VERSION);
    expect(state.ingredients.length).toBe(SEED_NAMES.length);
  });

  it("(c) old recipes without new fields get safe defaults (isFavorite false, tags [])", () => {
    const oldRecipe = {
      id: 100,
      title: "Starý recept",
      description: "popis",
      imagePath: null,
      cookingCount: 3,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-02T00:00:00.000Z",
      ingredients: [],
      // no isFavorite, no tags, no servings, etc.
    };
    const raw = JSON.stringify({
      seedVersion: SEED_VERSION,
      ingredients: [],
      recipes: [oldRecipe],
      pantrySelection: [],
      themeMode: "dark",
      recipeSortMode: "alphabetical",
    });
    const state = parseStoredState(raw);
    const parsed = state.recipes.find((r) => r.id === 100);
    expect(parsed).toBeDefined();
    expect(parsed!.isFavorite).toBe(false);
    expect(parsed!.tags).toEqual([]);
    expect(parsed!.servings).toBeUndefined();
    expect(parsed!.prepTimeMinutes).toBeUndefined();
    expect(parsed!.cookTimeMinutes).toBeUndefined();
  });

  it("(c2) preserves provided new fields when present and valid", () => {
    const recipe = {
      id: 101,
      title: "Novy",
      description: "",
      imagePath: null,
      cookingCount: 0,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ingredients: [],
      isFavorite: true,
      tags: ["sladke", 42, "rychle"], // 42 should be filtered out
      servings: 4,
      prepTimeMinutes: 15,
      cookTimeMinutes: 30,
    };
    const raw = JSON.stringify({ recipes: [recipe] });
    const state = parseStoredState(raw);
    const parsed = state.recipes.find((r) => r.id === 101)!;
    expect(parsed.isFavorite).toBe(true);
    expect(parsed.tags).toEqual(["sladke", "rychle"]); // non-string filtered
    expect(parsed.servings).toBe(4);
    expect(parsed.prepTimeMinutes).toBe(15);
    expect(parsed.cookTimeMinutes).toBe(30);
  });

  it("(d) invalid recipeSortMode falls back to 'alphabetical'", () => {
    const raw = JSON.stringify({
      recipes: [],
      ingredients: [],
      recipeSortMode: "totally-bogus",
    });
    const state = parseStoredState(raw);
    expect(state.recipeSortMode).toBe("alphabetical");
  });

  it("(d2) valid recipeSortMode is preserved", () => {
    const raw = JSON.stringify({ recipeSortMode: "mostCooked" });
    const state = parseStoredState(raw);
    expect(state.recipeSortMode).toBe("mostCooked");
  });

  it("(d3) invalid themeMode falls back to 'system'", () => {
    const raw = JSON.stringify({ themeMode: "neon" });
    const state = parseStoredState(raw);
    expect(state.themeMode).toBe("system");
  });

  it("(e) keeps valid recipes and ingredients and recomputes their normalized fields", () => {
    const ingredient = {
      id: 500,
      name: "Žampiony",
      normalizedName: "WRONG", // should be recomputed
      firstLetter: "X", // should be recomputed
      isFavorite: false,
      isSystem: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    const recipe = {
      id: 600,
      title: "Čočková polévka",
      normalizedTitle: "WRONG", // should be recomputed
      description: "",
      imagePath: null,
      cookingCount: 1,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      ingredients: [],
    };
    const raw = JSON.stringify({
      seedVersion: SEED_VERSION,
      ingredients: [ingredient],
      recipes: [recipe],
      pantrySelection: [500],
    });
    const state = parseStoredState(raw);

    const keptIngredient = state.ingredients.find((i) => i.id === 500)!;
    expect(keptIngredient).toBeDefined();
    expect(keptIngredient.normalizedName).toBe("zampiony");
    expect(keptIngredient.firstLetter).toBe("Z");

    const keptRecipe = state.recipes.find((r) => r.id === 600)!;
    expect(keptRecipe).toBeDefined();
    expect(keptRecipe.normalizedTitle).toBe("cockova polevka");

    // Legacy pantrySelection (v1) is migrated into pantry items (v2).
    expect(state.pantry.map((item) => item.ingredientId)).toEqual([500]);
  });

  it("(e2) drops invalid recipe/ingredient entries", () => {
    const raw = JSON.stringify({
      // Recepty už naseedované, ať se netestuje proti default receptům.
      recipeSeedVersion: RECIPE_SEED_VERSION,
      ingredients: [
        { id: 1, name: "Valid", createdAt: "x", updatedAt: "y" },
        { id: "not-a-number", name: "Invalid" }, // bad id
        { name: "MissingId", createdAt: "x", updatedAt: "y" }, // no id
        null,
        "string",
      ],
      recipes: [
        {
          id: 1,
          title: "Valid",
          description: "",
          cookingCount: 0,
          createdAt: "x",
          updatedAt: "y",
          ingredients: [],
        },
        { id: 2, title: "NoIngredientsArray", description: "", cookingCount: 0, createdAt: "x", updatedAt: "y" },
      ],
    });
    const state = parseStoredState(raw);
    // Only the one valid ingredient (id 1) is kept from the decoded list; the
    // rest of the ingredients come from the seed top-up.
    expect(state.ingredients.some((i) => i.id === 1 && i.name === "Valid")).toBe(true);
    expect(state.ingredients.some((i) => i.name === "Invalid")).toBe(false);
    expect(state.ingredients.some((i) => i.name === "MissingId")).toBe(false);
    // Only the valid recipe survives.
    expect(state.recipes.map((r) => r.id)).toEqual([1]);
  });

  it("filters non-RecipeIngredient entries out of a recipe's ingredient list", () => {
    const raw = JSON.stringify({
      recipes: [
        {
          id: 1,
          title: "Mix",
          description: "",
          cookingCount: 0,
          createdAt: "x",
          updatedAt: "y",
          ingredients: [
            {
              ingredientId: 1,
              ingredientNameSnapshot: "Mouka",
              normalizedIngredientName: "mouka",
              amountText: "200",
              unit: "g",
            },
            { broken: true },
            null,
          ],
        },
      ],
    });
    const state = parseStoredState(raw);
    const recipe = state.recipes.find((r) => r.id === 1)!;
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].ingredientNameSnapshot).toBe("Mouka");
  });

  it("missing seedVersion defaults to 0 in the decoded state but ensureSeedData bumps it to SEED_VERSION", () => {
    const raw = JSON.stringify({ recipes: [], ingredients: [] });
    const state = parseStoredState(raw);
    // After seed top-up the seedVersion is set to SEED_VERSION.
    expect(state.seedVersion).toBe(SEED_VERSION);
  });
});

// ---------------------------------------------------------------------------
// ensureSeedData
// ---------------------------------------------------------------------------

describe("ensureSeedData", () => {
  it("adds all missing seed ingredients to an empty state", () => {
    const state = makeState({ seedVersion: 0 });
    const result = ensureSeedData(state);
    expect(result.ingredients.length).toBe(SEED_NAMES.length);
    expect(result.seedVersion).toBe(SEED_VERSION);
  });

  it("only tops up the missing seed ingredients, keeping existing custom ones", () => {
    const custom = makeIngredient({
      id: 9999,
      name: "Moje Vlastni Surovina",
      isSystem: false,
    });
    const state = makeState({ ingredients: [custom] });
    const result = ensureSeedData(state);
    // Custom + all seeds (none of the seeds collide with the custom name).
    expect(result.ingredients.length).toBe(SEED_NAMES.length + 1);
    expect(result.ingredients.some((i) => i.id === 9999)).toBe(true);
  });

  it("does not duplicate seeds that are already present (matched by normalized name)", () => {
    const firstSeed = SEED_NAMES[0];
    const existing = makeIngredient({
      id: 1,
      name: prettifyIngredientName(firstSeed),
      normalizedName: normalizeText(firstSeed),
    });
    const state = makeState({ ingredients: [existing] });
    const result = ensureSeedData(state);
    // One already present, so only (length - 1) added => total == length.
    expect(result.ingredients.length).toBe(SEED_NAMES.length);
    const matching = result.ingredients.filter(
      (i) => i.normalizedName === normalizeText(firstSeed),
    );
    expect(matching).toHaveLength(1);
  });

  it("returns ingredients sorted by the Czech collator", () => {
    const result = ensureSeedData(makeState({ seedVersion: 0 }));
    const collator = new Intl.Collator("cs", { sensitivity: "base" });
    for (let i = 1; i < result.ingredients.length; i += 1) {
      expect(
        collator.compare(
          result.ingredients[i - 1].normalizedName,
          result.ingredients[i].normalizedName,
        ),
      ).toBeLessThanOrEqual(0);
    }
  });

  it("sorts recipes and pantry even when no seeds are missing", () => {
    // Build a state that already contains every seed so the early-return path runs.
    const seeded = createInitialState();
    const state: AppState = {
      ...seeded,
      recipeSeedVersion: RECIPE_SEED_VERSION,
      recipes: [
        makeRecipe({ id: 1, title: "Štrúdl" }),
        makeRecipe({ id: 2, title: "Ananasový dort" }),
      ],
      pantry: [5, 2, 9, 1].map((id) => makePantryItem(id)),
    };
    const result = ensureSeedData(state);
    expect(result.recipes.map((r) => r.title)).toEqual([
      "Ananasový dort",
      "Štrúdl",
    ]);
    expect(result.pantry.map((item) => item.ingredientId)).toEqual([1, 2, 5, 9]);
  });

  it("does not mutate the input state object's arrays", () => {
    const ingredients: Ingredient[] = [makeIngredient({ id: 1, name: "Cibule" })];
    const state = makeState({
      seedVersion: 0,
      ingredients,
      pantry: [makePantryItem(3), makePantryItem(1)],
    });
    const before = state.ingredients.length;
    ensureSeedData(state);
    expect(state.ingredients.length).toBe(before);
    expect(state.pantry.map((item) => item.ingredientId)).toEqual([3, 1]); // untouched
  });
});

// ---------------------------------------------------------------------------
// default recipe seeding
// ---------------------------------------------------------------------------

describe("default recipe seeding", () => {
  const SEED_RECIPE_TITLES = (defaultRecipes as { title: string }[]).map((r) => r.title);

  it("seeds all default recipes into a fresh state", () => {
    const result = ensureSeedData(createInitialState());
    expect(result.recipeSeedVersion).toBe(RECIPE_SEED_VERSION);
    for (const title of SEED_RECIPE_TITLES) {
      expect(result.recipes.some((r) => r.title === title)).toBe(true);
    }
    expect(result.recipes.length).toBeGreaterThanOrEqual(SEED_RECIPE_TITLES.length);
  });

  it("resolves every seeded recipe ingredient to an existing ingredient id", () => {
    const result = ensureSeedData(createInitialState());
    const ingredientIds = new Set(result.ingredients.map((i) => i.id));
    const seededRecipes = result.recipes.filter((r) => SEED_RECIPE_TITLES.includes(r.title));
    for (const recipe of seededRecipes) {
      for (const ri of recipe.ingredients) {
        expect(ri.ingredientId).not.toBeNull();
        expect(ingredientIds.has(ri.ingredientId as number)).toBe(true);
      }
    }
  });

  it("seeded recipes carry steps and image urls", () => {
    const result = ensureSeedData(createInitialState());
    const seeded = result.recipes.filter((r) => SEED_RECIPE_TITLES.includes(r.title));
    for (const recipe of seeded) {
      expect((recipe.steps ?? []).length).toBeGreaterThan(0);
      expect((recipe.imageUrls ?? []).length).toBeGreaterThan(0);
    }
  });

  it("does not seed again once recipeSeedVersion is current", () => {
    const once = ensureSeedData(createInitialState());
    const beforeCount = once.recipes.length;
    const twice = ensureSeedData(once);
    expect(twice.recipes.length).toBe(beforeCount);
  });

  it("does not duplicate a default recipe the user already has (matched by title)", () => {
    const state: AppState = {
      ...createInitialState(),
      recipes: [makeRecipe({ id: 1, title: SEED_RECIPE_TITLES[0] })],
    };
    const result = ensureSeedData(state);
    const matching = result.recipes.filter(
      (r) => normalizeText(r.title) === normalizeText(SEED_RECIPE_TITLES[0]),
    );
    expect(matching).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// exportStateToJson (round-trip)
// ---------------------------------------------------------------------------

describe("exportStateToJson", () => {
  it("produces valid JSON that re-parses to equivalent data (round-trip)", () => {
    const original = createInitialState();
    const customState: AppState = {
      ...original,
      recipes: [
        makeRecipe({
          id: 1,
          title: "Čočková polévka",
          description: "Dobrá",
          cookingCount: 4,
          isFavorite: true,
          tags: ["polevka", "luštěniny"],
          servings: 4,
          ingredients: [
            makeRecipeIngredient({
              ingredientId: 1,
              ingredientNameSnapshot: "Čočka",
              amountText: "200",
              unit: "g",
            }),
          ],
        }),
      ],
      pantry: [makePantryItem(1)],
      themeMode: "dark",
      recipeSortMode: "mostCooked",
    };

    const json = exportStateToJson(customState);
    // Valid JSON?
    expect(() => JSON.parse(json)).not.toThrow();

    const reparsed = parseStoredState(json);

    // Top-level scalar fields survive the round-trip.
    expect(reparsed.themeMode).toBe("dark");
    expect(reparsed.recipeSortMode).toBe("mostCooked");
    expect(reparsed.pantry.map((item) => item.ingredientId)).toEqual([1]);

    // The recipe survives with its meaningful fields intact.
    const recipe = reparsed.recipes.find((r) => r.id === 1)!;
    expect(recipe).toBeDefined();
    expect(recipe.title).toBe("Čočková polévka");
    expect(recipe.description).toBe("Dobrá");
    expect(recipe.cookingCount).toBe(4);
    expect(recipe.isFavorite).toBe(true);
    expect(recipe.tags).toEqual(["polevka", "luštěniny"]);
    expect(recipe.servings).toBe(4);
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.ingredients[0].ingredientNameSnapshot).toBe("Čočka");
    expect(recipe.ingredients[0].amountText).toBe("200");
    expect(recipe.ingredients[0].unit).toBe("g");
  });

  it("round-trips ingredients (custom + seeds remain consistent)", () => {
    const state: AppState = { ...createInitialState(), recipeSeedVersion: RECIPE_SEED_VERSION };
    const json = exportStateToJson(state);
    const reparsed = parseStoredState(json);
    // The seeded ingredient set is stable across an export/import round-trip.
    expect(reparsed.ingredients.length).toBe(state.ingredients.length);
    const originalNames = state.ingredients.map((i) => i.normalizedName).sort();
    const reparsedNames = reparsed.ingredients.map((i) => i.normalizedName).sort();
    expect(reparsedNames).toEqual(originalNames);
  });

  it("uses 2-space pretty printing", () => {
    const json = exportStateToJson(createInitialState());
    expect(json).toContain('\n  "seedVersion"');
  });
});

// ---------------------------------------------------------------------------
// getUnitLabel
// ---------------------------------------------------------------------------

describe("getUnitLabel", () => {
  it("returns the human label for a known unit", () => {
    expect(getUnitLabel("g")).toBe("g");
    expect(getUnitLabel("lzicka")).toBe("lžička");
    expect(getUnitLabel("lzice")).toBe("lžíce");
    expect(getUnitLabel("par")).toBe("pár");
    expect(getUnitLabel("ks")).toBe("ks");
  });

  it("falls back to the raw unit value when unknown", () => {
    // Cast to bypass the union type and exercise the fallback branch.
    expect(getUnitLabel("unknown" as never)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// resolveTheme
// ---------------------------------------------------------------------------

describe("resolveTheme", () => {
  it("system + prefersDark=true resolves to dark", () => {
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("system + prefersDark=false resolves to light", () => {
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("explicit 'light' ignores the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("explicit 'dark' ignores the system preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
