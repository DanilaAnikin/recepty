import { describe, expect, it } from "vitest";

import { normalizeText, type MealPlanEntry, type Recipe } from "./domain";
import {
  addDays,
  buildWeek,
  countPlannedMeals,
  fromDateKey,
  plannedRecipesInRange,
  shortDateLabel,
  slotLabel,
  startOfWeek,
  toDateKey,
  weekdayLabel,
  weekdayShortLabel,
} from "./planner";

function recipe(id: number, title: string, servings?: number): Recipe {
  const now = "2024-01-01T00:00:00.000Z";
  return {
    id,
    title,
    normalizedTitle: normalizeText(title),
    description: "",
    imagePath: null,
    cookingCount: 0,
    createdAt: now,
    updatedAt: now,
    ingredients: [],
    servings,
  };
}

function entry(partial: Partial<MealPlanEntry> & { date: string }): MealPlanEntry {
  return {
    id: partial.id ?? 1,
    date: partial.date,
    slot: partial.slot ?? "lunch",
    recipeId: partial.recipeId ?? null,
    customTitle: partial.customTitle,
    servings: partial.servings,
  };
}

describe("toDateKey / fromDateKey", () => {
  it("formats a local date without shifting time zones", () => {
    // Late evening: toISOString() would already report the next day in UTC+.
    expect(toDateKey(new Date(2024, 8, 3, 23, 30))).toBe("2024-09-03");
  });

  it("pads month and day", () => {
    expect(toDateKey(new Date(2024, 0, 5))).toBe("2024-01-05");
  });

  it("round-trips through fromDateKey", () => {
    const key = "2024-09-03";
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });

  it("returns an invalid date for a malformed key", () => {
    expect(Number.isNaN(fromDateKey("nope").getTime())).toBe(true);
  });
});

describe("addDays", () => {
  it("moves forward across a month boundary", () => {
    expect(toDateKey(addDays(new Date(2024, 0, 30), 3))).toBe("2024-02-02");
  });

  it("moves backwards", () => {
    expect(toDateKey(addDays(new Date(2024, 0, 2), -3))).toBe("2023-12-30");
  });

  it("does not mutate its input", () => {
    const date = new Date(2024, 0, 1);
    addDays(date, 5);
    expect(toDateKey(date)).toBe("2024-01-01");
  });
});

describe("startOfWeek", () => {
  it("returns Monday for a Wednesday", () => {
    // 2024-09-04 is a Wednesday.
    expect(toDateKey(startOfWeek(new Date(2024, 8, 4)))).toBe("2024-09-02");
  });

  it("returns the same day when it is already Monday", () => {
    expect(toDateKey(startOfWeek(new Date(2024, 8, 2)))).toBe("2024-09-02");
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    // 2024-09-08 is a Sunday; its week starts on 2024-09-02.
    expect(toDateKey(startOfWeek(new Date(2024, 8, 8)))).toBe("2024-09-02");
  });
});

describe("labels", () => {
  it("names the weekday in Czech", () => {
    expect(weekdayLabel("2024-09-02")).toBe("Pondělí");
    expect(weekdayLabel("2024-09-08")).toBe("Neděle");
  });

  it("has short weekday labels", () => {
    expect(weekdayShortLabel("2024-09-02")).toBe("Po");
  });

  it("formats a short date", () => {
    expect(shortDateLabel("2024-09-03")).toBe("3. 9.");
  });

  it("names meal slots", () => {
    expect(slotLabel("lunch")).toBe("Oběd");
    expect(slotLabel("dinner")).toBe("Večeře");
  });
});

describe("buildWeek", () => {
  it("always returns seven days starting from the given Monday", () => {
    const week = buildWeek(new Date(2024, 8, 2), []);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2024-09-02");
    expect(week[6].date).toBe("2024-09-08");
  });

  it("attaches entries to their day", () => {
    const week = buildWeek(new Date(2024, 8, 2), [entry({ id: 1, date: "2024-09-03" })]);
    expect(week[0].entries).toHaveLength(0);
    expect(week[1].entries).toHaveLength(1);
  });

  it("orders a day's entries breakfast -> lunch -> dinner", () => {
    const week = buildWeek(new Date(2024, 8, 2), [
      entry({ id: 1, date: "2024-09-02", slot: "dinner" }),
      entry({ id: 2, date: "2024-09-02", slot: "breakfast" }),
      entry({ id: 3, date: "2024-09-02", slot: "lunch" }),
    ]);
    expect(week[0].entries.map((item) => item.slot)).toEqual(["breakfast", "lunch", "dinner"]);
  });

  it("marks today", () => {
    const week = buildWeek(new Date(2024, 8, 2), [], new Date(2024, 8, 4));
    expect(week.filter((day) => day.isToday).map((day) => day.date)).toEqual(["2024-09-04"]);
  });

  it("marks no day as today when today is outside the week", () => {
    const week = buildWeek(new Date(2024, 8, 2), [], new Date(2024, 9, 1));
    expect(week.some((day) => day.isToday)).toBe(false);
  });

  it("ignores entries outside the week", () => {
    const week = buildWeek(new Date(2024, 8, 2), [entry({ id: 1, date: "2024-10-01" })]);
    expect(countPlannedMeals(week)).toBe(0);
  });
});

describe("plannedRecipesInRange", () => {
  const recipes = [recipe(1, "Guláš", 4), recipe(2, "Palačinky", 2)];

  it("returns the recipes planned inside the range", () => {
    const planned = plannedRecipesInRange(
      [entry({ id: 1, date: "2024-09-03", recipeId: 1 })],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned.map((item) => item.recipe.title)).toEqual(["Guláš"]);
  });

  it("includes the range boundaries", () => {
    const planned = plannedRecipesInRange(
      [
        entry({ id: 1, date: "2024-09-02", recipeId: 1 }),
        entry({ id: 2, date: "2024-09-08", recipeId: 2 }),
      ],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned).toHaveLength(2);
  });

  it("excludes dates outside the range", () => {
    const planned = plannedRecipesInRange(
      [entry({ id: 1, date: "2024-09-09", recipeId: 1 })],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned).toEqual([]);
  });

  it("repeats a recipe planned twice so the amounts add up", () => {
    const planned = plannedRecipesInRange(
      [
        entry({ id: 1, date: "2024-09-02", recipeId: 1 }),
        entry({ id: 2, date: "2024-09-05", recipeId: 1 }),
      ],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned).toHaveLength(2);
  });

  it("carries the planned servings through", () => {
    const planned = plannedRecipesInRange(
      [entry({ id: 1, date: "2024-09-02", recipeId: 1, servings: 8 })],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned[0].servings).toBe(8);
  });

  it("skips entries with no recipe (hand-written meals)", () => {
    const planned = plannedRecipesInRange(
      [entry({ id: 1, date: "2024-09-02", recipeId: null, customTitle: "Zbytky" })],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned).toEqual([]);
  });

  it("skips entries pointing at a deleted recipe", () => {
    const planned = plannedRecipesInRange(
      [entry({ id: 1, date: "2024-09-02", recipeId: 999 })],
      recipes,
      "2024-09-02",
      "2024-09-08",
    );
    expect(planned).toEqual([]);
  });
});
