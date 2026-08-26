import { describe, expect, it } from "vitest";

import { normalizeText, type Recipe } from "./domain";
import {
  collectTags,
  createDefaultFilters,
  filterAndSortRecipes,
  hasActiveFilters,
  totalTimeMinutes,
  type RecipeFilters,
} from "./filters";

function ing(name: string, ingredientId: number | null) {
  return {
    ingredientId,
    ingredientNameSnapshot: name,
    normalizedIngredientName: normalizeText(name),
    amountText: "",
    unit: "g" as const,
  };
}

function recipe(partial: Partial<Recipe> & { title: string }): Recipe {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: partial.id ?? 1,
    title: partial.title,
    normalizedTitle: normalizeText(partial.title),
    description: partial.description ?? "",
    imagePath: null,
    cookingCount: partial.cookingCount ?? 0,
    createdAt: now,
    updatedAt: partial.updatedAt ?? now,
    ingredients: partial.ingredients ?? [],
    tags: partial.tags ?? [],
    steps: partial.steps ?? [],
    isFavorite: partial.isFavorite,
    servings: partial.servings,
    prepTimeMinutes: partial.prepTimeMinutes,
    cookTimeMinutes: partial.cookTimeMinutes,
    rating: partial.rating,
    cookLog: partial.cookLog,
  };
}

function filters(overrides: Partial<RecipeFilters> = {}): RecipeFilters {
  return { ...createDefaultFilters(), ...overrides };
}

describe("totalTimeMinutes", () => {
  it("adds prep and cook time", () => {
    expect(totalTimeMinutes(recipe({ title: "A", prepTimeMinutes: 10, cookTimeMinutes: 20 }))).toBe(30);
  });

  it("works with only one of the two filled in", () => {
    expect(totalTimeMinutes(recipe({ title: "A", cookTimeMinutes: 20 }))).toBe(20);
  });

  it("returns null when neither is filled in", () => {
    expect(totalTimeMinutes(recipe({ title: "A" }))).toBeNull();
  });
});

describe("collectTags", () => {
  it("counts tags across recipes and orders by frequency", () => {
    const tags = collectTags([
      recipe({ id: 1, title: "A", tags: ["rychlé", "polévka"] }),
      recipe({ id: 2, title: "B", tags: ["rychlé"] }),
    ]);
    expect(tags[0].normalized).toBe("rychle");
    expect(tags[0].count).toBe(2);
  });

  it("merges tags differing only in diacritics or case", () => {
    const tags = collectTags([
      recipe({ id: 1, title: "A", tags: ["Rychlé"] }),
      recipe({ id: 2, title: "B", tags: ["rychle"] }),
    ]);
    expect(tags).toHaveLength(1);
    expect(tags[0].count).toBe(2);
  });

  it("ignores blank tags", () => {
    expect(collectTags([recipe({ title: "A", tags: ["  "] })])).toEqual([]);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the defaults", () => {
    expect(hasActiveFilters(createDefaultFilters())).toBe(false);
  });

  it("notices a query", () => {
    expect(hasActiveFilters(filters({ query: "kure" }))).toBe(true);
  });

  it("notices a time limit", () => {
    expect(hasActiveFilters(filters({ maxTotalTime: 30 }))).toBe(true);
  });

  it("notices a missing-ingredient limit", () => {
    expect(hasActiveFilters(filters({ maxMissing: 1 }))).toBe(true);
  });
});

describe("filterAndSortRecipes", () => {
  const recipes = [
    recipe({
      id: 1,
      title: "Bramboračka",
      tags: ["polévka"],
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      ingredients: [ing("Brambory", 1), ing("Houby", 2)],
    }),
    recipe({
      id: 2,
      title: "Guláš",
      tags: ["maso"],
      prepTimeMinutes: 20,
      cookTimeMinutes: 100,
      isFavorite: true,
      ingredients: [ing("Hovězí", 3), ing("Cibule", 4), ing("Paprika", 5)],
    }),
    recipe({
      id: 3,
      title: "Ananasový salát",
      tags: ["rychlé", "polévka"],
      ingredients: [ing("Ananas", 6)],
    }),
  ];

  it("returns everything with the default filters and an empty pantry", () => {
    const entries = filterAndSortRecipes(recipes, new Set(), createDefaultFilters(), "alphabetical");
    expect(entries).toHaveLength(3);
  });

  it("sorts alphabetically with Czech collation when not searching", () => {
    const entries = filterAndSortRecipes(recipes, new Set(), createDefaultFilters(), "alphabetical");
    expect(entries.map((entry) => entry.recipe.title)).toEqual([
      "Ananasový salát",
      "Bramboračka",
      "Guláš",
    ]);
  });

  it("filters to favorites only", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ favoritesOnly: true }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.title)).toEqual(["Guláš"]);
  });

  it("filters by tag", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ tags: ["polevka"] }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.id).sort()).toEqual([1, 3]);
  });

  it("requires all selected tags (AND)", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ tags: ["polevka", "rychle"] }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.id)).toEqual([3]);
  });

  it("filters by maximum total time", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ maxTotalTime: 30 }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.title)).toEqual(["Bramboračka"]);
  });

  it("excludes recipes with no time at all from a time-limited search", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ maxTotalTime: 300 }),
      "alphabetical",
    );
    // "Ananasový salát" has no times filled in, so it cannot be proven to fit.
    expect(entries.map((entry) => entry.recipe.id).sort()).toEqual([1, 2]);
  });

  it("finds recipes where at most one ingredient is missing", () => {
    // Bramboračka: nothing missing. Guláš: paprika missing. Salát: ananas missing.
    const pantry = new Set([1, 2, 3, 4]);
    const entries = filterAndSortRecipes(
      recipes,
      pantry,
      filters({ maxMissing: 1 }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.id).sort()).toEqual([1, 2, 3]);
  });

  it("excludes a recipe once too many ingredients are missing", () => {
    // Only potatoes at home: Guláš misses 3, Salát misses 1.
    const entries = filterAndSortRecipes(
      recipes,
      new Set([1]),
      filters({ maxMissing: 1 }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.id).sort()).toEqual([1, 3]);
  });

  it("maxMissing 0 means everything is at home", () => {
    const pantry = new Set([1, 2, 3, 4]);
    const entries = filterAndSortRecipes(recipes, pantry, filters({ maxMissing: 0 }), "alphabetical");
    expect(entries.map((entry) => entry.recipe.id)).toEqual([1]);
  });

  it("sorts by fewest missing ingredients", () => {
    const pantry = new Set([1, 2, 3, 4]);
    const entries = filterAndSortRecipes(
      recipes,
      pantry,
      filters({ maxMissing: 5 }),
      "leastMissing",
    );
    const missingCounts = entries.map((entry) => entry.match.missingIngredients.length);
    expect(missingCounts).toEqual([...missingCounts].sort((a, b) => a - b));
    expect(entries[0].recipe.title).toBe("Bramboračka");
  });

  it("ranks by relevance while searching, overriding the sort mode", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ query: "gulas" }),
      "alphabetical",
    );
    expect(entries[0].recipe.title).toBe("Guláš");
  });

  it("reports missing ingredients on the entry", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set([1]),
      filters({ maxMissing: 5 }),
      "alphabetical",
    );
    const bramboracka = entries.find((entry) => entry.recipe.id === 1)!;
    expect(bramboracka.match.missingIngredients).toEqual(["Houby"]);
  });

  it("returns an empty list when nothing matches", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ query: "cokolada" }),
      "alphabetical",
    );
    expect(entries).toEqual([]);
  });

  it("combines a tag filter with a search query", () => {
    const entries = filterAndSortRecipes(
      recipes,
      new Set(),
      filters({ query: "salat", tags: ["rychle"] }),
      "alphabetical",
    );
    expect(entries.map((entry) => entry.recipe.id)).toEqual([3]);
  });
});
