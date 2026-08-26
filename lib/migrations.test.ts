import { describe, expect, it } from "vitest";

import { SCHEMA_VERSION, detectSchemaVersion, migrateState } from "./migrations";

describe("detectSchemaVersion", () => {
  it("treats data without a version as v1", () => {
    expect(detectSchemaVersion({})).toBe(1);
  });

  it("reads an explicit version", () => {
    expect(detectSchemaVersion({ schemaVersion: 2 })).toBe(2);
  });

  it("ignores a nonsense version", () => {
    expect(detectSchemaVersion({ schemaVersion: "two" })).toBe(1);
    expect(detectSchemaVersion({ schemaVersion: 0 })).toBe(1);
  });
});

describe("migrateState v1 -> v2", () => {
  it("turns pantrySelection into pantry items", () => {
    const migrated = migrateState({ pantrySelection: [3, 7] }) as {
      pantry: Array<{ ingredientId: number }>;
    };
    expect(migrated.pantry.map((item) => item.ingredientId)).toEqual([3, 7]);
  });

  it("drops the old pantrySelection field", () => {
    expect(migrateState({ pantrySelection: [1] })).not.toHaveProperty("pantrySelection");
  });

  it("gives every migrated pantry item a timestamp", () => {
    const migrated = migrateState({ pantrySelection: [1] }) as {
      pantry: Array<{ updatedAt: string }>;
    };
    expect(typeof migrated.pantry[0].updatedAt).toBe("string");
  });

  it("adds empty collections for the new features", () => {
    const migrated = migrateState({}) as Record<string, unknown>;
    expect(migrated.mealPlan).toEqual([]);
    expect(migrated.shoppingList).toEqual([]);
  });

  it("stamps the current schema version", () => {
    expect((migrateState({}) as { schemaVersion: number }).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("keeps unrelated fields untouched", () => {
    const migrated = migrateState({ themeMode: "dark", recipes: [{ id: 1 }] }) as Record<string, unknown>;
    expect(migrated.themeMode).toBe("dark");
    expect(migrated.recipes).toEqual([{ id: 1 }]);
  });

  it("ignores non-numeric entries in the legacy selection", () => {
    const migrated = migrateState({ pantrySelection: [1, "x", null] }) as {
      pantry: Array<{ ingredientId: number }>;
    };
    expect(migrated.pantry.map((item) => item.ingredientId)).toEqual([1]);
  });

  it("is idempotent — running it twice changes nothing further", () => {
    const once = migrateState({ pantrySelection: [1, 2] });
    const twice = migrateState(once);
    expect(twice).toEqual(once);
  });

  it("does not clobber an already-migrated pantry", () => {
    const migrated = migrateState({
      pantrySelection: [9],
      pantry: [{ ingredientId: 1, updatedAt: "x" }],
    }) as { pantry: Array<{ ingredientId: number }> };
    expect(migrated.pantry.map((item) => item.ingredientId)).toEqual([1]);
  });

  it("leaves data from a newer version alone", () => {
    const future = { schemaVersion: 99, somethingNew: true };
    const migrated = migrateState(future) as Record<string, unknown>;
    expect(migrated.schemaVersion).toBe(99);
    expect(migrated.somethingNew).toBe(true);
  });

  it("does not mutate the input object", () => {
    const input = { pantrySelection: [1] };
    migrateState(input);
    expect(input).toEqual({ pantrySelection: [1] });
  });
});
