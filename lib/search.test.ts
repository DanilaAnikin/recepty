import { describe, expect, it } from "vitest";

import { normalizeText, type Recipe } from "./domain";
import { allowedTypos, boundedEditDistance, buildSearchIndex, scoreRecipe } from "./search";

function makeRecipe(partial: Partial<Recipe> & { title: string }): Recipe {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id: partial.id ?? 1,
    title: partial.title,
    normalizedTitle: normalizeText(partial.title),
    description: partial.description ?? "",
    imagePath: null,
    cookingCount: 0,
    createdAt: now,
    updatedAt: now,
    ingredients: partial.ingredients ?? [],
    tags: partial.tags ?? [],
    steps: partial.steps ?? [],
  };
}

function indexOf(partial: Partial<Recipe> & { title: string }) {
  return buildSearchIndex(makeRecipe(partial));
}

function ingredient(name: string) {
  return {
    ingredientId: null,
    ingredientNameSnapshot: name,
    normalizedIngredientName: normalizeText(name),
    amountText: "",
    unit: "g" as const,
  };
}

describe("boundedEditDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(boundedEditDistance("mouka", "mouka", 2)).toBe(0);
  });

  it("counts a single substitution", () => {
    expect(boundedEditDistance("mouka", "mouha", 2)).toBe(1);
  });

  it("counts an insertion", () => {
    expect(boundedEditDistance("mouka", "moukaa", 2)).toBe(1);
  });

  it("bails out early when the length difference already exceeds the budget", () => {
    expect(boundedEditDistance("a", "abcdef", 2)).toBe(3);
  });

  it("reports over-budget as maxDistance + 1", () => {
    expect(boundedEditDistance("mouka", "cukr", 1)).toBe(2);
  });

  it("treats any difference as distance 1 when no typos are allowed", () => {
    expect(boundedEditDistance("ab", "ba", 0)).toBe(1);
  });
});

describe("allowedTypos", () => {
  it("allows none for very short tokens", () => {
    expect(allowedTypos("sul")).toBe(0);
  });

  it("allows one for medium tokens", () => {
    expect(allowedTypos("mouka")).toBe(1);
  });

  it("allows two for long tokens", () => {
    expect(allowedTypos("bramborovy")).toBe(2);
  });
});

describe("scoreRecipe", () => {
  const bramboracka = indexOf({
    title: "Bramboračka",
    description: "Hustá polévka z brambor a hub.",
    tags: ["polévka", "levné"],
    steps: ["Brambory oloupej a nakrájej na kostky."],
    ingredients: [ingredient("Brambory"), ingredient("Houby"), ingredient("Majoránka")],
  });

  it("returns 1 for an empty query so everything matches", () => {
    expect(scoreRecipe(bramboracka, "")).toBe(1);
    expect(scoreRecipe(bramboracka, "   ")).toBe(1);
  });

  it("matches the title ignoring diacritics", () => {
    expect(scoreRecipe(bramboracka, "bramboracka")).toBeGreaterThan(0);
    expect(scoreRecipe(bramboracka, "BRAMBORAČKA")).toBeGreaterThan(0);
  });

  it("scores a title hit higher than an ingredient hit", () => {
    const titleHit = scoreRecipe(bramboracka, "bramboracka");
    const ingredientHit = scoreRecipe(bramboracka, "majoranka");
    expect(titleHit).toBeGreaterThan(ingredientHit);
  });

  it("scores an ingredient hit higher than a steps-only hit", () => {
    const ingredientHit = scoreRecipe(bramboracka, "houby");
    const stepHit = scoreRecipe(bramboracka, "oloupej");
    expect(ingredientHit).toBeGreaterThan(stepHit);
  });

  it("finds recipes by tag", () => {
    expect(scoreRecipe(bramboracka, "polevka")).toBeGreaterThan(0);
  });

  it("searches inside the steps, which the old substring search could not", () => {
    expect(scoreRecipe(bramboracka, "kostky")).toBeGreaterThan(0);
  });

  it("tolerates a one-letter typo", () => {
    expect(scoreRecipe(bramboracka, "bramboracks")).toBeGreaterThan(0);
  });

  it("ranks the exact spelling above the typo", () => {
    expect(scoreRecipe(bramboracka, "bramboracka")).toBeGreaterThan(
      scoreRecipe(bramboracka, "bramboracks"),
    );
  });

  it("returns 0 for something the recipe does not contain", () => {
    expect(scoreRecipe(bramboracka, "cokolada")).toBe(0);
  });

  it("requires every token to match (AND semantics)", () => {
    expect(scoreRecipe(bramboracka, "brambory houby")).toBeGreaterThan(0);
    expect(scoreRecipe(bramboracka, "brambory cokolada")).toBe(0);
  });

  it("rewards a prefix match over a mid-word match", () => {
    const prefix = indexOf({ title: "Kuřecí kari" });
    const middle = indexOf({ title: "Domácí kuře na paprice" });
    expect(scoreRecipe(prefix, "kureci")).toBeGreaterThan(scoreRecipe(middle, "kureci"));
  });

  it("does not fuzzy-match short tokens, which would be too noisy", () => {
    const solRecipe = indexOf({ title: "Sůl" });
    expect(scoreRecipe(solRecipe, "sur")).toBe(0);
  });
});
