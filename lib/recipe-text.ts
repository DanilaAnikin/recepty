import { getUnitLabel, scaleAmount, type Recipe } from "./domain";

/**
 * Převod receptu na čitelný prostý text — pro `navigator.share`, kopírování
 * do schránky a odeslání do zpráv. Žádný markdown: cílem je, aby to vypadalo
 * dobře i ve WhatsAppu, který formátování nezobrazí.
 */

export type RecipeTextOptions = {
  /** Na kolik porcí přepočítat množství. Bez toho se použije počet z receptu. */
  servings?: number;
  /** Připojit na konec odkaz (např. sdílenou URL aplikace). */
  url?: string;
};

export function recipeToText(recipe: Recipe, options: RecipeTextOptions = {}): string {
  const baseServings =
    typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
  const targetServings = options.servings && options.servings > 0 ? options.servings : baseServings;
  const factor =
    baseServings !== null && targetServings !== null && targetServings > 0
      ? targetServings / baseServings
      : 1;

  const lines: string[] = [recipe.title];

  const meta: string[] = [];
  if (targetServings !== null) {
    meta.push(`${targetServings} porcí`);
  }
  const time = totalTimeLabel(recipe);
  if (time) {
    meta.push(time);
  }
  if (meta.length > 0) {
    lines.push(meta.join(" · "));
  }

  if (recipe.description.trim().length > 0) {
    lines.push("", recipe.description.trim());
  }

  if (recipe.ingredients.length > 0) {
    lines.push("", "Ingredience:");
    for (const ingredient of recipe.ingredients) {
      const amount =
        ingredient.amountText.trim().length > 0
          ? ` — ${factor === 1 ? ingredient.amountText : scaleAmount(ingredient.amountText, factor)} ${getUnitLabel(ingredient.unit)}`
          : "";
      lines.push(`• ${ingredient.ingredientNameSnapshot}${amount}`);
    }
  }

  const steps = recipe.steps ?? [];
  if (steps.length > 0) {
    lines.push("", "Postup:");
    steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
  }

  if (recipe.notes && recipe.notes.trim().length > 0) {
    lines.push("", `Poznámka: ${recipe.notes.trim()}`);
  }

  if (recipe.sourceUrl) {
    lines.push("", `Zdroj: ${recipe.sourceUrl}`);
  }

  if (options.url) {
    lines.push("", options.url);
  }

  return lines.join("\n");
}

export function totalTimeLabel(recipe: Recipe): string | null {
  const prep = typeof recipe.prepTimeMinutes === "number" ? recipe.prepTimeMinutes : 0;
  const cook = typeof recipe.cookTimeMinutes === "number" ? recipe.cookTimeMinutes : 0;
  const total = prep + cook;
  if (total <= 0) {
    return null;
  }
  if (total < 60) {
    return `${total} min`;
  }
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
