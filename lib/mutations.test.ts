import { describe, expect, it } from "vitest";

import {
  SCHEMA_VERSION,
  createSyncSettings,
  normalizeText,
  RECIPE_SEED_VERSION,
  SEED_VERSION,
  type AppState,
  type Ingredient,
  type Recipe,
  type ShoppingItem,
} from "./domain";
import * as mutations from "./mutations";

function ingredient(id: number, name: string): Ingredient {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id,
    name,
    normalizedName: normalizeText(name),
    firstLetter: normalizeText(name).charAt(0).toUpperCase(),
    isFavorite: false,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };
}

function recipeLine(name: string, ingredientId: number | null, amount = "100") {
  return {
    ingredientId,
    ingredientNameSnapshot: name,
    normalizedIngredientName: normalizeText(name),
    amountText: amount,
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
    updatedAt: now,
    ingredients: partial.ingredients ?? [],
    isFavorite: partial.isFavorite,
    cookLog: partial.cookLog,
    servings: partial.servings,
  };
}

function state(partial: Partial<AppState> = {}): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    recipeSeedVersion: RECIPE_SEED_VERSION,
    ingredients: partial.ingredients ?? [],
    recipes: partial.recipes ?? [],
    pantry: partial.pantry ?? [],
    mealPlan: partial.mealPlan ?? [],
    shoppingList: partial.shoppingList ?? [],
    themeMode: partial.themeMode ?? "system",
    recipeSortMode: partial.recipeSortMode ?? "alphabetical",
    sync: partial.sync ?? createSyncSettings(),
    revision: partial.revision ?? 0,
    updatedAt: "2024-01-01T00:00:00.000Z",
    lastBackupAt: null,
  };
}

function shoppingItem(partial: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    id: partial.id ?? 1,
    name: partial.name,
    normalizedName: normalizeText(partial.name),
    ingredientId: partial.ingredientId ?? null,
    amountText: partial.amountText ?? "",
    unit: partial.unit ?? null,
    checked: partial.checked ?? false,
    source: partial.source ?? "manual",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("recipe mutations", () => {
  it("adds a new recipe", () => {
    const next = mutations.upsertRecipe(state(), recipe({ id: 5, title: "Guláš" }));
    expect(next.recipes.map((item) => item.id)).toEqual([5]);
  });

  it("updates an existing recipe in place", () => {
    const base = state({ recipes: [recipe({ id: 5, title: "Guláš" })] });
    const next = mutations.upsertRecipe(base, recipe({ id: 5, title: "Guláš na paprice" }));
    expect(next.recipes).toHaveLength(1);
    expect(next.recipes[0].title).toBe("Guláš na paprice");
  });

  it("recomputes the normalized title on save", () => {
    const next = mutations.upsertRecipe(state(), recipe({ id: 1, title: "Čočka" }));
    expect(next.recipes[0].normalizedTitle).toBe("cocka");
  });

  it("does not mutate the input state", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "A" })] });
    mutations.upsertRecipe(base, recipe({ id: 2, title: "B" }));
    expect(base.recipes).toHaveLength(1);
  });

  it("deletes a recipe and any plan entries pointing at it", () => {
    const base = state({
      recipes: [recipe({ id: 1, title: "A" })],
      mealPlan: [{ id: 1, date: "2024-09-02", slot: "lunch", recipeId: 1 }],
    });
    const next = mutations.deleteRecipe(base, 1);
    expect(next.recipes).toEqual([]);
    expect(next.mealPlan).toEqual([]);
  });

  it("toggles the favorite flag both ways", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "A" })] });
    const on = mutations.toggleRecipeFavorite(base, 1);
    expect(on.recipes[0].isFavorite).toBe(true);
    expect(mutations.toggleRecipeFavorite(on, 1).recipes[0].isFavorite).toBe(false);
  });

  it("duplicates a recipe with a '(kopie)' title", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "Guláš" })] });
    const next = mutations.duplicateRecipe(base, 1);
    expect(next.recipes.map((item) => item.title).sort()).toEqual(["Guláš", "Guláš (kopie)"]);
  });

  it("numbers further duplicates so titles stay unique", () => {
    let next = state({ recipes: [recipe({ id: 1, title: "Guláš" })] });
    next = mutations.duplicateRecipe(next, 1);
    next = mutations.duplicateRecipe(next, 1);
    expect(next.recipes.map((item) => item.title)).toContain("Guláš (kopie 2)");
  });

  it("resets cooking history on a duplicate", () => {
    const base = state({
      recipes: [
        recipe({
          id: 1,
          title: "Guláš",
          cookingCount: 7,
          isFavorite: true,
          cookLog: [{ id: 1, cookedAt: "2024-05-01T00:00:00.000Z" }],
        }),
      ],
    });
    const copy = mutations.duplicateRecipe(base, 1).recipes.find((r) => r.title.includes("kopie"))!;
    expect(copy.cookingCount).toBe(0);
    expect(copy.cookLog).toEqual([]);
    expect(copy.isFavorite).toBe(false);
  });

  it("ignores duplicating a recipe that does not exist", () => {
    const base = state();
    expect(mutations.duplicateRecipe(base, 99)).toBe(base);
  });
});

describe("cook log", () => {
  it("records a cook and bumps the counter", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "A" })] });
    const next = mutations.addCookLogEntry(base, 1, { cookedAt: "2024-09-01T10:00:00.000Z" });
    expect(next.recipes[0].cookingCount).toBe(1);
    expect(next.recipes[0].cookLog).toHaveLength(1);
  });

  it("stores rating and note with the entry", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "A" })] });
    const next = mutations.addCookLogEntry(base, 1, {
      cookedAt: "2024-09-01T10:00:00.000Z",
      rating: 5,
      note: "Příště míň soli",
    });
    expect(next.recipes[0].cookLog?.[0].rating).toBe(5);
    expect(next.recipes[0].cookLog?.[0].note).toBe("Příště míň soli");
  });

  it("gives each entry a unique id", () => {
    let next = state({ recipes: [recipe({ id: 1, title: "A" })] });
    next = mutations.addCookLogEntry(next, 1, { cookedAt: "2024-09-01T00:00:00.000Z" });
    next = mutations.addCookLogEntry(next, 1, { cookedAt: "2024-09-02T00:00:00.000Z" });
    const ids = next.recipes[0].cookLog!.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("removes an entry and decrements the counter", () => {
    let next = state({ recipes: [recipe({ id: 1, title: "A" })] });
    next = mutations.addCookLogEntry(next, 1, { cookedAt: "2024-09-01T00:00:00.000Z" });
    const entryId = next.recipes[0].cookLog![0].id;
    next = mutations.removeCookLogEntry(next, 1, entryId);
    expect(next.recipes[0].cookingCount).toBe(0);
    expect(next.recipes[0].cookLog).toEqual([]);
  });

  it("never lets the counter go negative", () => {
    const base = state({ recipes: [recipe({ id: 1, title: "A", cookingCount: 0 })] });
    expect(mutations.removeCookLogEntry(base, 1, 99).recipes[0].cookingCount).toBe(0);
  });
});

describe("ingredient mutations", () => {
  it("adds a new ingredient with a prettified name", () => {
    const { state: next, ingredient: created } = mutations.addIngredient(state(), "hrubá mouka");
    expect(created.name).toBe("Hrubá Mouka");
    expect(next.ingredients).toHaveLength(1);
  });

  it("returns the existing ingredient instead of duplicating it", () => {
    const base = state({ ingredients: [ingredient(1, "Mouka")] });
    const { state: next, ingredient: found } = mutations.addIngredient(base, "mouka");
    expect(found.id).toBe(1);
    expect(next.ingredients).toHaveLength(1);
  });

  it("renames an ingredient and updates the snapshot inside recipes", () => {
    const base = state({
      ingredients: [ingredient(1, "Mouka")],
      recipes: [recipe({ id: 1, title: "A", ingredients: [recipeLine("Mouka", 1)] })],
    });
    const next = mutations.renameIngredient(base, 1, "hladká mouka");
    expect(next.ingredients[0].name).toBe("Hladká Mouka");
    expect(next.recipes[0].ingredients[0].ingredientNameSnapshot).toBe("Hladká Mouka");
  });

  it("counts recipes using an ingredient", () => {
    const base = state({
      recipes: [
        recipe({ id: 1, title: "A", ingredients: [recipeLine("Mouka", 1)] }),
        recipe({ id: 2, title: "B", ingredients: [recipeLine("Cukr", 2)] }),
      ],
    });
    expect(mutations.countRecipesUsingIngredient(base, 1)).toBe(1);
  });

  it("deleting an ingredient keeps the recipe line but drops the link", () => {
    const base = state({
      ingredients: [ingredient(1, "Mouka")],
      recipes: [recipe({ id: 1, title: "A", ingredients: [recipeLine("Mouka", 1)] })],
      pantry: [{ ingredientId: 1, updatedAt: "x" }],
    });
    const next = mutations.deleteIngredient(base, 1);
    expect(next.ingredients).toEqual([]);
    expect(next.recipes[0].ingredients).toHaveLength(1);
    expect(next.recipes[0].ingredients[0].ingredientId).toBeNull();
    expect(next.recipes[0].ingredients[0].ingredientNameSnapshot).toBe("Mouka");
    expect(next.pantry).toEqual([]);
  });
});

describe("pantry mutations", () => {
  it("adds an item with quantity and expiry", () => {
    const next = mutations.setPantryItem(state(), {
      ingredientId: 1,
      quantity: "500",
      unit: "g",
      expiresAt: "2024-12-01",
      updatedAt: "x",
    });
    expect(next.pantry[0].quantity).toBe("500");
    expect(next.pantry[0].expiresAt).toBe("2024-12-01");
  });

  it("replaces an existing item rather than adding a second one", () => {
    const base = state({ pantry: [{ ingredientId: 1, quantity: "100", updatedAt: "x" }] });
    const next = mutations.setPantryItem(base, { ingredientId: 1, quantity: "200", updatedAt: "x" });
    expect(next.pantry).toHaveLength(1);
    expect(next.pantry[0].quantity).toBe("200");
  });

  it("toggles an item on and off", () => {
    const on = mutations.togglePantryItem(state(), 1);
    expect(on.pantry).toHaveLength(1);
    expect(mutations.togglePantryItem(on, 1).pantry).toEqual([]);
  });

  it("replacePantry keeps quantities of items that stay", () => {
    const base = state({
      pantry: [{ ingredientId: 1, quantity: "500", unit: "g", updatedAt: "x" }],
    });
    const next = mutations.replacePantry(base, [1, 2]);
    expect(next.pantry.find((item) => item.ingredientId === 1)?.quantity).toBe("500");
    expect(next.pantry.find((item) => item.ingredientId === 2)?.quantity).toBeUndefined();
  });

  it("replacePantry drops items no longer selected", () => {
    const base = state({ pantry: [{ ingredientId: 1, updatedAt: "x" }] });
    expect(mutations.replacePantry(base, [2]).pantry.map((i) => i.ingredientId)).toEqual([2]);
  });
});

describe("shopping list mutations", () => {
  it("adds a manual item", () => {
    const next = mutations.addManualShoppingItem(state(), "Toaletní papír");
    expect(next.shoppingList.map((item) => item.name)).toEqual(["Toaletní papír"]);
  });

  it("links a manual item to a known ingredient", () => {
    const base = state({ ingredients: [ingredient(3, "Mouka")] });
    const next = mutations.addManualShoppingItem(base, "mouka");
    expect(next.shoppingList[0].ingredientId).toBe(3);
  });

  it("ignores a blank manual item", () => {
    expect(mutations.addManualShoppingItem(state(), "   ").shoppingList).toEqual([]);
  });

  it("toggles an item as bought", () => {
    const base = state({ shoppingList: [shoppingItem({ id: 1, name: "Mouka" })] });
    expect(mutations.toggleShoppingItem(base, 1).shoppingList[0].checked).toBe(true);
  });

  it("clears only the checked items", () => {
    const base = state({
      shoppingList: [
        shoppingItem({ id: 1, name: "Mouka", checked: true }),
        shoppingItem({ id: 2, name: "Cukr" }),
      ],
    });
    expect(mutations.clearCheckedShoppingItems(base).shoppingList.map((i) => i.name)).toEqual(["Cukr"]);
  });

  it("moves checked items into the pantry", () => {
    const base = state({
      ingredients: [ingredient(1, "Mouka")],
      shoppingList: [
        shoppingItem({ id: 1, name: "Mouka", ingredientId: 1, amountText: "500", unit: "g", checked: true }),
      ],
    });
    const next = mutations.moveCheckedToPantry(base);
    expect(next.shoppingList).toEqual([]);
    expect(next.pantry[0]).toMatchObject({ ingredientId: 1, quantity: "500", unit: "g" });
  });

  it("drops checked items with no ingredient link instead of losing them silently in the pantry", () => {
    const base = state({
      shoppingList: [shoppingItem({ id: 1, name: "Ubrousky", checked: true })],
    });
    const next = mutations.moveCheckedToPantry(base);
    expect(next.shoppingList).toEqual([]);
    expect(next.pantry).toEqual([]);
  });
});

describe("meal plan mutations", () => {
  it("adds an entry with a fresh id", () => {
    const next = mutations.addMealPlanEntry(state(), {
      date: "2024-09-02",
      slot: "lunch",
      recipeId: 1,
    });
    expect(next.mealPlan).toHaveLength(1);
    expect(next.mealPlan[0].id).toBeGreaterThan(0);
  });

  it("updates an existing entry in place", () => {
    const base = state({ mealPlan: [{ id: 1, date: "2024-09-02", slot: "lunch", recipeId: 1 }] });
    const next = mutations.upsertMealPlanEntry(base, {
      id: 1,
      date: "2024-09-02",
      slot: "dinner",
      recipeId: 2,
    });
    expect(next.mealPlan).toHaveLength(1);
    expect(next.mealPlan[0].slot).toBe("dinner");
  });

  it("removes an entry", () => {
    const base = state({ mealPlan: [{ id: 1, date: "2024-09-02", slot: "lunch", recipeId: 1 }] });
    expect(mutations.removeMealPlanEntry(base, 1).mealPlan).toEqual([]);
  });

  it("clears a date range inclusive of both ends", () => {
    const base = state({
      mealPlan: [
        { id: 1, date: "2024-09-02", slot: "lunch", recipeId: 1 },
        { id: 2, date: "2024-09-08", slot: "lunch", recipeId: 1 },
        { id: 3, date: "2024-09-09", slot: "lunch", recipeId: 1 },
      ],
    });
    const next = mutations.clearMealPlanRange(base, "2024-09-02", "2024-09-08");
    expect(next.mealPlan.map((entry) => entry.id)).toEqual([3]);
  });
});

describe("settings mutations", () => {
  it("sets the theme", () => {
    expect(mutations.setThemeMode(state(), "dark").themeMode).toBe("dark");
  });

  it("merges sync settings without wiping the rest", () => {
    const next = mutations.setSyncSettings(state(), { enabled: true });
    expect(next.sync.enabled).toBe(true);
    expect(next.sync.endpoint).toBe("");
  });

  it("stamps the backup time", () => {
    expect(mutations.markBackupTaken(state()).lastBackupAt).not.toBeNull();
  });
});
