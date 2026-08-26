import { describe, expect, it } from "vitest";

import {
  parseIngredientLine,
  parseIsoDuration,
  parseRecipeFromHtml,
  parseRecipeFromText,
  parseServings,
  stripHtml,
} from "./recipe-import";

describe("parseIngredientLine", () => {
  it("splits amount, unit and name", () => {
    expect(parseIngredientLine("200 g hladké mouky")).toEqual({
      name: "hladké mouky",
      amount: "200",
      unit: "g",
    });
  });

  it("understands Czech spoon declensions", () => {
    expect(parseIngredientLine("2 lžíce olivového oleje")).toEqual({
      name: "olivového oleje",
      amount: "2",
      unit: "lzice",
    });
    expect(parseIngredientLine("1 lžička soli")?.unit).toBe("lzicka");
    expect(parseIngredientLine("3 lžičky cukru")?.unit).toBe("lzicka");
  });

  it("does not mistake 'lžíce' for litres", () => {
    expect(parseIngredientLine("2 lžíce mouky")?.unit).not.toBe("l");
  });

  it("understands spelled-out gram forms", () => {
    expect(parseIngredientLine("250 gramů cukru")?.unit).toBe("g");
  });

  it("understands kilograms", () => {
    expect(parseIngredientLine("1 kg brambor")).toEqual({
      name: "brambor",
      amount: "1",
      unit: "kg",
    });
  });

  it("understands litres", () => {
    expect(parseIngredientLine("1 l mléka")?.unit).toBe("l");
  });

  it("defaults to pieces when there is a number but no unit", () => {
    expect(parseIngredientLine("3 vejce")).toEqual({ name: "vejce", amount: "3", unit: "ks" });
  });

  it("keeps descriptive lines whole", () => {
    expect(parseIngredientLine("špetka soli")).toEqual({
      name: "špetka soli",
      amount: "",
      unit: "ks",
    });
  });

  it("strips bullet characters", () => {
    expect(parseIngredientLine("• 200 g mouky")?.name).toBe("mouky");
    expect(parseIngredientLine("- 200 g mouky")?.amount).toBe("200");
  });

  it("keeps fractions", () => {
    expect(parseIngredientLine("1/2 lžičky soli")).toEqual({
      name: "soli",
      amount: "1/2",
      unit: "lzicka",
    });
  });

  it("expands unicode fractions", () => {
    expect(parseIngredientLine("½ lžičky soli")?.amount).toBe("1/2");
  });

  it("keeps ranges", () => {
    expect(parseIngredientLine("2-3 stroužky česneku")?.amount).toBe("2-3");
  });

  it("keeps comma decimals", () => {
    expect(parseIngredientLine("1,5 l vody")).toEqual({ name: "vody", amount: "1,5", unit: "l" });
  });

  it("returns null for a blank line", () => {
    expect(parseIngredientLine("   ")).toBeNull();
  });

  it("handles a bare number with nothing after it", () => {
    expect(parseIngredientLine("200")?.name).toBe("200");
  });
});

describe("parseIsoDuration", () => {
  it("parses minutes", () => {
    expect(parseIsoDuration("PT30M")).toBe(30);
  });

  it("parses hours and minutes", () => {
    expect(parseIsoDuration("PT1H30M")).toBe(90);
  });

  it("parses days", () => {
    expect(parseIsoDuration("P1DT2H")).toBe(26 * 60);
  });

  it("accepts a plain number of minutes", () => {
    expect(parseIsoDuration(45)).toBe(45);
  });

  it("falls back to plain Czech text", () => {
    expect(parseIsoDuration("30 min")).toBe(30);
    expect(parseIsoDuration("2 hod")).toBe(120);
  });

  it("returns undefined for nonsense", () => {
    expect(parseIsoDuration("chvilku")).toBeUndefined();
    expect(parseIsoDuration(null)).toBeUndefined();
    expect(parseIsoDuration("PT0M")).toBeUndefined();
  });
});

describe("parseServings", () => {
  it("reads a number", () => {
    expect(parseServings(4)).toBe(4);
  });

  it("reads the leading number out of text", () => {
    expect(parseServings("4 porce")).toBe(4);
    expect(parseServings("Serves 6")).toBe(6);
  });

  it("takes the first usable entry of an array", () => {
    expect(parseServings(["4 porce"])).toBe(4);
  });

  it("returns undefined when there is no number", () => {
    expect(parseServings("dle chuti")).toBeUndefined();
    expect(parseServings(null)).toBeUndefined();
  });
});

describe("stripHtml", () => {
  it("removes tags", () => {
    expect(stripHtml("<p>Ahoj <b>světe</b></p>")).toBe("Ahoj světe");
  });

  it("turns <br> into newlines", () => {
    expect(stripHtml("a<br>b")).toBe("a\nb");
  });

  it("decodes common entities", () => {
    expect(stripHtml("sůl &amp; pepř")).toBe("sůl & pepř");
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });
});

describe("parseRecipeFromHtml", () => {
  const jsonLd = (payload: unknown) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(payload)}</script></head><body></body></html>`;

  it("extracts a plain Recipe node", () => {
    const html = jsonLd({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Bramborový salát",
      description: "Klasika.",
      recipeIngredient: ["500 g brambor", "2 lžíce majonézy"],
      recipeInstructions: ["Uvař brambory.", "Smíchej."],
      recipeYield: "4 porce",
      prepTime: "PT20M",
      cookTime: "PT30M",
      keywords: "vánoce, klasika",
      image: "https://example.com/salat.jpg",
    });

    const recipe = parseRecipeFromHtml(html, "https://example.com/r");
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe("Bramborový salát");
    expect(recipe!.servings).toBe(4);
    expect(recipe!.prepTimeMinutes).toBe(20);
    expect(recipe!.cookTimeMinutes).toBe(30);
    expect(recipe!.steps).toEqual(["Uvař brambory.", "Smíchej."]);
    expect(recipe!.ingredients).toHaveLength(2);
    expect(recipe!.ingredients[0]).toEqual({ name: "brambor", amount: "500", unit: "g" });
    expect(recipe!.tags).toContain("vánoce");
    expect(recipe!.imageUrls).toEqual(["https://example.com/salat.jpg"]);
    expect(recipe!.sourceUrl).toBe("https://example.com/r");
  });

  it("finds a Recipe nested inside @graph", () => {
    const html = jsonLd({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Blog" },
        { "@type": "Recipe", name: "Guláš", recipeIngredient: ["1 kg hovězího"] },
      ],
    });
    expect(parseRecipeFromHtml(html)?.title).toBe("Guláš");
  });

  it("handles @type given as an array", () => {
    const html = jsonLd({ "@type": ["Article", "Recipe"], name: "Svíčková" });
    expect(parseRecipeFromHtml(html)?.title).toBe("Svíčková");
  });

  it("handles a top-level array of nodes", () => {
    const html = jsonLd([{ "@type": "Organization" }, { "@type": "Recipe", name: "Řízek" }]);
    expect(parseRecipeFromHtml(html)?.title).toBe("Řízek");
  });

  it("unpacks HowToStep instructions", () => {
    const html = jsonLd({
      "@type": "Recipe",
      name: "X",
      recipeInstructions: [
        { "@type": "HowToStep", text: "Krok jedna." },
        { "@type": "HowToStep", text: "Krok dva." },
      ],
    });
    expect(parseRecipeFromHtml(html)?.steps).toEqual(["Krok jedna.", "Krok dva."]);
  });

  it("unpacks HowToSection instructions", () => {
    const html = jsonLd({
      "@type": "Recipe",
      name: "X",
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Těsto",
          itemListElement: [{ "@type": "HowToStep", text: "Zamíchej." }],
        },
      ],
    });
    expect(parseRecipeFromHtml(html)?.steps).toEqual(["Zamíchej."]);
  });

  it("splits instructions given as one HTML blob", () => {
    const html = jsonLd({
      "@type": "Recipe",
      name: "X",
      recipeInstructions: "<p>Krok jedna.</p><p>Krok dva.</p>",
    });
    expect(parseRecipeFromHtml(html)?.steps).toEqual(["Krok jedna.", "Krok dva."]);
  });

  it("reads an image given as an ImageObject", () => {
    const html = jsonLd({
      "@type": "Recipe",
      name: "X",
      image: { "@type": "ImageObject", url: "https://example.com/a.jpg" },
    });
    expect(parseRecipeFromHtml(html)?.imageUrls).toEqual(["https://example.com/a.jpg"]);
  });

  it("drops non-http image values", () => {
    const html = jsonLd({ "@type": "Recipe", name: "X", image: "/relativni.jpg" });
    expect(parseRecipeFromHtml(html)?.imageUrls).toEqual([]);
  });

  it("puts totalTime into cook time when the split is unknown", () => {
    const html = jsonLd({ "@type": "Recipe", name: "X", totalTime: "PT50M" });
    const recipe = parseRecipeFromHtml(html);
    expect(recipe?.cookTimeMinutes).toBe(50);
    expect(recipe?.prepTimeMinutes).toBeUndefined();
  });

  it("skips a malformed JSON-LD block and uses the next one", () => {
    const html =
      '<script type="application/ld+json">{ broken </script>' +
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "Ok" })}</script>`;
    expect(parseRecipeFromHtml(html)?.title).toBe("Ok");
  });

  it("returns null when there is no recipe on the page", () => {
    expect(parseRecipeFromHtml("<html><body>nic</body></html>")).toBeNull();
  });

  it("returns null for a Recipe node with no name", () => {
    expect(parseRecipeFromHtml(jsonLd({ "@type": "Recipe", description: "x" }))).toBeNull();
  });
});

describe("parseRecipeFromText", () => {
  it("uses the first line as the title", () => {
    expect(parseRecipeFromText("Palačinky\n200 g mouky").title).toBe("Palačinky");
  });

  it("respects explicit Czech headings", () => {
    const recipe = parseRecipeFromText(
      ["Palačinky", "Ingredience:", "200 g mouky", "2 vejce", "Postup:", "Smíchej.", "Smaž."].join("\n"),
    );
    expect(recipe.ingredients.map((item) => item.name)).toEqual(["mouky", "vejce"]);
    expect(recipe.steps).toEqual(["Smíchej.", "Smaž."]);
  });

  it("accepts 'Suroviny' as an ingredient heading", () => {
    const recipe = parseRecipeFromText(["X", "Suroviny", "1 kg brambor"].join("\n"));
    expect(recipe.ingredients).toHaveLength(1);
  });

  it("falls back to line shape when there are no headings", () => {
    const recipe = parseRecipeFromText(
      ["Palačinky", "200 g mouky", "2 vejce", "Všechno smíchej a smaž na pánvi."].join("\n"),
    );
    expect(recipe.ingredients.map((item) => item.name)).toEqual(["mouky", "vejce"]);
    expect(recipe.steps).toEqual(["Všechno smíchej a smaž na pánvi."]);
  });

  it("strips step numbering", () => {
    const recipe = parseRecipeFromText(["X", "Postup:", "1. Smíchej.", "2. Smaž."].join("\n"));
    expect(recipe.steps).toEqual(["Smíchej.", "Smaž."]);
  });

  it("ignores blank lines", () => {
    const recipe = parseRecipeFromText("Palačinky\n\n\n200 g mouky\n");
    expect(recipe.ingredients).toHaveLength(1);
  });

  it("returns an empty recipe for empty input", () => {
    const recipe = parseRecipeFromText("   ");
    expect(recipe.title).toBe("");
    expect(recipe.ingredients).toEqual([]);
  });

  it("keeps the source URL", () => {
    expect(parseRecipeFromText("X\n1 kg mouky", "https://e.com").sourceUrl).toBe("https://e.com");
  });
});
