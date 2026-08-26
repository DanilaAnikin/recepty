import { describe, expect, it } from "vitest";

import {
  areUnitsCompatible,
  formatAmountNumber,
  fromBaseAmount,
  mergeAmounts,
  parseAmount,
  toBaseAmount,
  unitFamily,
} from "./units";

describe("unitFamily / areUnitsCompatible", () => {
  it("groups mass units together", () => {
    expect(unitFamily("g")).toBe("mass");
    expect(unitFamily("kg")).toBe("mass");
    expect(areUnitsCompatible("g", "kg")).toBe(true);
  });

  it("treats spoons as volume so they merge with millilitres", () => {
    expect(unitFamily("lzice")).toBe("volume");
    expect(unitFamily("lzicka")).toBe("volume");
    expect(areUnitsCompatible("lzice", "ml")).toBe(true);
  });

  it("keeps mass and volume apart", () => {
    expect(areUnitsCompatible("g", "ml")).toBe(false);
  });

  it("treats 'pár' as a count of two pieces", () => {
    expect(unitFamily("par")).toBe("count");
    expect(toBaseAmount(1, "par")).toBe(2);
  });
});

describe("toBaseAmount / fromBaseAmount", () => {
  it("converts kilograms to grams and back", () => {
    expect(toBaseAmount(1.5, "kg")).toBe(1500);
    expect(fromBaseAmount(1500, "kg")).toBe(1.5);
  });

  it("uses 5 ml per teaspoon and 15 ml per tablespoon", () => {
    expect(toBaseAmount(2, "lzicka")).toBe(10);
    expect(toBaseAmount(2, "lzice")).toBe(30);
  });
});

describe("parseAmount", () => {
  it("parses a plain integer", () => {
    expect(parseAmount("200")).toEqual({ value: 200, isRange: false, usesComma: false });
  });

  it("parses a comma decimal and remembers the comma", () => {
    expect(parseAmount("1,5")).toEqual({ value: 1.5, isRange: false, usesComma: true });
  });

  it("parses a dot decimal", () => {
    expect(parseAmount("0.25")?.value).toBe(0.25);
  });

  it("parses a fraction into its numeric value", () => {
    expect(parseAmount("1/2")?.value).toBe(0.5);
  });

  it("takes the upper bound of a range so there is enough to buy", () => {
    const parsed = parseAmount("2-3");
    expect(parsed?.value).toBe(3);
    expect(parsed?.isRange).toBe(true);
  });

  it("handles an en dash range", () => {
    expect(parseAmount("2–3")?.value).toBe(3);
  });

  it("returns null for descriptive amounts", () => {
    expect(parseAmount("špetka")).toBeNull();
    expect(parseAmount("dle chuti")).toBeNull();
  });

  it("returns null for blank input", () => {
    expect(parseAmount("   ")).toBeNull();
  });

  it("returns null for a zero denominator", () => {
    expect(parseAmount("1/0")).toBeNull();
  });
});

describe("formatAmountNumber", () => {
  it("drops trailing zeros", () => {
    expect(formatAmountNumber(400)).toBe("400");
    expect(formatAmountNumber(1.5)).toBe("1.5");
  });

  it("rounds to two decimals", () => {
    expect(formatAmountNumber(1.23456)).toBe("1.23");
  });

  it("can use a comma as the decimal separator", () => {
    expect(formatAmountNumber(1.5, true)).toBe("1,5");
  });
});

describe("mergeAmounts", () => {
  it("sums two amounts in the same unit", () => {
    expect(mergeAmounts([
      { value: 200, unit: "g" },
      { value: 300, unit: "g" },
    ])).toEqual({ value: 500, unit: "g", text: "500" });
  });

  it("promotes grams to kilograms once the total is large", () => {
    const merged = mergeAmounts([
      { value: 800, unit: "g" },
      { value: 700, unit: "g" },
    ]);
    expect(merged).toEqual({ value: 1.5, unit: "kg", text: "1.5" });
  });

  it("demotes kilograms to grams when the total is below one kilo", () => {
    const merged = mergeAmounts([{ value: 0.5, unit: "kg" }]);
    expect(merged).toEqual({ value: 500, unit: "g", text: "500" });
  });

  it("keeps teaspoons as teaspoons instead of collapsing to millilitres", () => {
    const merged = mergeAmounts([
      { value: 1, unit: "lzicka" },
      { value: 2, unit: "lzicka" },
    ]);
    expect(merged?.unit).toBe("lzicka");
    expect(merged?.value).toBe(3);
  });

  it("merges spoons into millilitres when millilitres dominate", () => {
    const merged = mergeAmounts([
      { value: 2, unit: "lzice" },
      { value: 50, unit: "ml" },
    ]);
    expect(merged?.unit).toBe("ml");
    expect(merged?.value).toBe(80);
  });

  it("refuses to merge across unit families", () => {
    expect(mergeAmounts([
      { value: 1, unit: "g" },
      { value: 1, unit: "ml" },
    ])).toBeNull();
  });

  it("returns null for an empty input", () => {
    expect(mergeAmounts([])).toBeNull();
  });
});
