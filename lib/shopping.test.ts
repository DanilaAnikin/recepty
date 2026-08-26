import { describe, expect, it } from "vitest";

import { normalizeText, type IngredientUnit, type Recipe, type ShoppingItem } from "./domain";
import {
  buildShoppingItems,
  formatShoppingAmount,
  mergeIntoShoppingList,
  servingsFactor,
  shoppingListToText,
  sortShoppingItems,
} from "./shopping";

function ing(
  name: string,
  amount: string,
  unit: IngredientUnit,
  ingredientId: number | null = null,
) {
  return {
    ingredientId,
    ingredientNameSnapshot: name,
    normalizedIngredientName: normalizeText(name),
    amountText: amount,
    unit,
  };
}

function recipe(partial: Partial<Recipe> & { title: string }): Recipe {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: partial.id ?? 1,
    title: partial.title,
    normalizedTitle: normalizeText(partial.title),
    description: "",
    imagePath: null,
    cookingCount: 0,
    createdAt: now,
    updatedAt: now,
    ingredients: partial.ingredients ?? [],
    servings: partial.servings,
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
    recipeTitles: partial.recipeTitles,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

describe("servingsFactor", () => {
  it("is 1 when the recipe has no servings", () => {
    expect(servingsFactor(recipe({ title: "X" }), 8)).toBe(1);
  });

  it("is 1 when no target is requested", () => {
    expect(servingsFactor(recipe({ title: "X", servings: 4 }))).toBe(1);
  });

  it("doubles for twice the servings", () => {
    expect(servingsFactor(recipe({ title: "X", servings: 4 }), 8)).toBe(2);
  });

  it("halves for half the servings", () => {
    expect(servingsFactor(recipe({ title: "X", servings: 4 }), 2)).toBe(0.5);
  });
});

describe("buildShoppingItems", () => {
  it("sums the same ingredient across two recipes", () => {
    const items = buildShoppingItems([
      { recipe: recipe({ id: 1, title: "A", ingredients: [ing("Mouka", "200", "g", 10)] }) },
      { recipe: recipe({ id: 2, title: "B", ingredients: [ing("Mouka", "300", "g", 10)] }) },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].amountText).toBe("500");
    expect(items[0].unit).toBe("g");
  });

  it("records which recipes an item came from", () => {
    const items = buildShoppingItems([
      { recipe: recipe({ id: 1, title: "Buchty", ingredients: [ing("Mouka", "200", "g", 10)] }) },
      { recipe: recipe({ id: 2, title: "Koláč", ingredients: [ing("Mouka", "300", "g", 10)] }) },
    ]);

    expect(items[0].recipeTitles?.sort()).toEqual(["Buchty", "Koláč"]);
  });

  it("scales amounts to the requested servings", () => {
    const items = buildShoppingItems([
      {
        recipe: recipe({
          title: "A",
          servings: 4,
          ingredients: [ing("Mouka", "200", "g", 10)],
        }),
        servings: 8,
      },
    ]);

    expect(items[0].amountText).toBe("400");
  });

  it("skips what is already in the pantry when asked to", () => {
    const items = buildShoppingItems(
      [
        {
          recipe: recipe({
            title: "A",
            ingredients: [ing("Mouka", "200", "g", 10), ing("Cukr", "50", "g", 11)],
          }),
        },
      ],
      { pantryIds: new Set([10]), skipPantry: true },
    );

    expect(items.map((item) => item.name)).toEqual(["Cukr"]);
  });

  it("keeps pantry items when not asked to skip them", () => {
    const items = buildShoppingItems(
      [{ recipe: recipe({ title: "A", ingredients: [ing("Mouka", "200", "g", 10)] }) }],
      { pantryIds: new Set([10]), skipPantry: false },
    );

    expect(items).toHaveLength(1);
  });

  it("matches ingredients without an id by their normalized name", () => {
    const items = buildShoppingItems([
      { recipe: recipe({ id: 1, title: "A", ingredients: [ing("Mouka", "200", "g")] }) },
      { recipe: recipe({ id: 2, title: "B", ingredients: [ing("mouka", "100", "g")] }) },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].amountText).toBe("300");
  });

  it("keeps unmergeable units side by side instead of dropping one", () => {
    const items = buildShoppingItems([
      {
        recipe: recipe({
          id: 1,
          title: "A",
          ingredients: [ing("Olej", "50", "ml", 10), ing("Olej", "20", "g", 10)],
        }),
      },
    ]);

    expect(items[0].unit).toBeNull();
    expect(items[0].amountText).toContain("+");
    expect(items[0].amountText).toContain("50");
    expect(items[0].amountText).toContain("20");
  });

  it("keeps descriptive amounts like 'špetka' visible", () => {
    const items = buildShoppingItems([
      {
        recipe: recipe({
          id: 1,
          title: "A",
          ingredients: [ing("Sůl", "špetka", "g", 10), ing("Sůl", "10", "g", 10)],
        }),
      },
    ]);

    expect(items[0].amountText).toContain("špetka");
    expect(items[0].amountText).toContain("10");
  });

  it("merges spoons with millilitres of the same ingredient", () => {
    const items = buildShoppingItems([
      {
        recipe: recipe({
          id: 1,
          title: "A",
          ingredients: [ing("Olej", "2", "lzice", 10), ing("Olej", "50", "ml", 10)],
        }),
      },
    ]);

    expect(items[0].unit).toBe("ml");
    expect(items[0].amountText).toBe("80");
  });

  it("numbers items from the requested starting id", () => {
    const items = buildShoppingItems(
      [{ recipe: recipe({ title: "A", ingredients: [ing("Mouka", "1", "kg", 10)] }) }],
      { startId: 50 },
    );
    expect(items[0].id).toBe(50);
  });

  it("returns an empty list for no sources", () => {
    expect(buildShoppingItems([])).toEqual([]);
  });
});

describe("mergeIntoShoppingList", () => {
  it("adds a brand new item", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 1, name: "Mouka", ingredientId: 10 })],
      [shoppingItem({ id: 99, name: "Cukr", ingredientId: 11 })],
    );
    expect(result.map((item) => item.name).sort()).toEqual(["Cukr", "Mouka"]);
  });

  it("gives the added item a fresh id so it cannot collide", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 7, name: "Mouka", ingredientId: 10 })],
      [shoppingItem({ id: 7, name: "Cukr", ingredientId: 11 })],
    );
    const ids = result.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sums amounts of the same ingredient instead of duplicating the row", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 1, name: "Mouka", ingredientId: 10, amountText: "200", unit: "g" })],
      [shoppingItem({ id: 2, name: "Mouka", ingredientId: 10, amountText: "300", unit: "g" })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].amountText).toBe("500");
  });

  it("unchecks an item when more of it is needed again", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 1, name: "Mouka", ingredientId: 10, amountText: "200", unit: "g", checked: true })],
      [shoppingItem({ id: 2, name: "Mouka", ingredientId: 10, amountText: "100", unit: "g" })],
    );
    expect(result[0].checked).toBe(false);
  });

  it("merges by normalized name when there is no ingredient id", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 1, name: "Mouka", amountText: "200", unit: "g" })],
      [shoppingItem({ id: 2, name: "mouka", amountText: "100", unit: "g" })],
    );
    expect(result).toHaveLength(1);
  });

  it("keeps both amounts when the units cannot be summed", () => {
    const result = mergeIntoShoppingList(
      [shoppingItem({ id: 1, name: "Olej", ingredientId: 10, amountText: "50", unit: "ml" })],
      [shoppingItem({ id: 2, name: "Olej", ingredientId: 10, amountText: "20", unit: "g" })],
    );
    expect(result[0].amountText).toContain("+");
    expect(result[0].unit).toBeNull();
  });
});

describe("sortShoppingItems", () => {
  it("pushes checked items to the bottom", () => {
    const sorted = sortShoppingItems([
      shoppingItem({ id: 1, name: "Ananas", checked: true }),
      shoppingItem({ id: 2, name: "Zázvor", checked: false }),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["Zázvor", "Ananas"]);
  });

  it("sorts unchecked items alphabetically with Czech collation", () => {
    const sorted = sortShoppingItems([
      shoppingItem({ id: 1, name: "Žampiony" }),
      shoppingItem({ id: 2, name: "Cibule" }),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["Cibule", "Žampiony"]);
  });
});

describe("formatShoppingAmount / shoppingListToText", () => {
  it("appends the unit label", () => {
    expect(formatShoppingAmount(shoppingItem({ name: "Mouka", amountText: "500", unit: "g" }))).toBe(
      "500 g",
    );
  });

  it("returns an empty string when there is no amount", () => {
    expect(formatShoppingAmount(shoppingItem({ name: "Mouka" }))).toBe("");
  });

  it("lists only unchecked items", () => {
    const text = shoppingListToText([
      shoppingItem({ id: 1, name: "Mouka", amountText: "500", unit: "g" }),
      shoppingItem({ id: 2, name: "Cukr", checked: true }),
    ]);
    expect(text).toContain("Mouka");
    expect(text).not.toContain("Cukr");
  });

  it("says so when everything is already bought", () => {
    expect(shoppingListToText([shoppingItem({ name: "Mouka", checked: true })])).toContain("hotový");
  });
});
