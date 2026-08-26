import {
  evaluateRecipe,
  normalizeText,
  sortRecipesBy,
  type Recipe,
  type RecipeMatchMode,
  type RecipeMatchResult,
  type RecipeSortMode,
} from "./domain";
import { buildSearchIndex, scoreRecipe, type RecipeSearchIndex } from "./search";

/**
 * Skládání filtrů nad seznamem receptů.
 *
 * Textové hledání sem vstupuje přes `lib/search.ts` (skórované, s tolerancí
 * překlepů), párování se spíží přes `evaluateRecipe` z domény. Sem patří
 * i řazení "nejmíň chybí", které v doméně udělat nešlo — potřebuje výsledek
 * párování, který doména v tu chvíli nemá.
 */

export type RecipeFilters = {
  query: string;
  favoritesOnly: boolean;
  /** Normalizované štítky; recept musí mít všechny (AND). */
  tags: string[];
  matchMode: RecipeMatchMode;
  /** Horní mez celkového času v minutách (příprava + vaření). */
  maxTotalTime: number | null;
  /** Nejvýš tolik chybějících ingrediencí. 0 = "mám všechno". */
  maxMissing: number | null;
};

export type RecipeEntry = {
  recipe: Recipe;
  match: RecipeMatchResult;
  score: number;
};

export function createDefaultFilters(): RecipeFilters {
  return {
    query: "",
    favoritesOnly: false,
    tags: [],
    matchMode: "full",
    maxTotalTime: null,
    maxMissing: null,
  };
}

export function hasActiveFilters(filters: RecipeFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.favoritesOnly ||
    filters.tags.length > 0 ||
    filters.maxTotalTime !== null ||
    filters.maxMissing !== null
  );
}

/** Celkový čas receptu, nebo `null` když není vyplněný ani jeden údaj. */
export function totalTimeMinutes(recipe: Recipe): number | null {
  const prep = typeof recipe.prepTimeMinutes === "number" ? recipe.prepTimeMinutes : 0;
  const cook = typeof recipe.cookTimeMinutes === "number" ? recipe.cookTimeMinutes : 0;
  const total = prep + cook;
  return total > 0 ? total : null;
}

/** Všechny štítky napříč recepty s počtem výskytů, od nejčastějšího. */
export function collectTags(recipes: Recipe[]): Array<{ tag: string; normalized: string; count: number }> {
  const byNormalized = new Map<string, { tag: string; normalized: string; count: number }>();

  for (const recipe of recipes) {
    for (const rawTag of recipe.tags ?? []) {
      const normalized = normalizeText(rawTag);
      if (normalized.length === 0) {
        continue;
      }
      const existing = byNormalized.get(normalized);
      if (existing) {
        existing.count += 1;
      } else {
        byNormalized.set(normalized, { tag: rawTag, normalized, count: 1 });
      }
    }
  }

  return [...byNormalized.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.normalized.localeCompare(right.normalized, "cs");
  });
}

function matchesTags(recipe: Recipe, wantedTags: string[]): boolean {
  if (wantedTags.length === 0) {
    return true;
  }
  const recipeTags = new Set((recipe.tags ?? []).map(normalizeText));
  return wantedTags.every((tag) => recipeTags.has(tag));
}

/**
 * Aplikuje všechny filtry a vrátí seřazené položky.
 *
 * Při neprázdném dotazu se řadí podle relevance bez ohledu na zvolený režim
 * řazení — když uživatel hledá, chce nahoře nejlepší shodu, ne abecedu.
 */
export function filterAndSortRecipes(
  recipes: Recipe[],
  pantryIds: Set<number>,
  filters: RecipeFilters,
  sortMode: RecipeSortMode,
  searchIndexes?: Map<number, RecipeSearchIndex>,
): RecipeEntry[] {
  const query = filters.query.trim();
  const isSearching = query.length > 0;

  const entries: RecipeEntry[] = [];

  for (const recipe of recipes) {
    if (filters.favoritesOnly && recipe.isFavorite !== true) {
      continue;
    }
    if (!matchesTags(recipe, filters.tags)) {
      continue;
    }
    if (filters.maxTotalTime !== null) {
      const total = totalTimeMinutes(recipe);
      // Recept bez vyplněného času nemůžeme tvrdit, že se do limitu vejde.
      if (total === null || total > filters.maxTotalTime) {
        continue;
      }
    }

    const index = searchIndexes?.get(recipe.id) ?? buildSearchIndex(recipe);
    const score = isSearching ? scoreRecipe(index, query) : 1;
    if (score === 0) {
      continue;
    }

    // Prázdný dotaz -> `evaluateRecipe` řeší jen spíž, text je no-op.
    const match = evaluateRecipe(recipe, pantryIds, "", filters.matchMode);

    if (filters.maxMissing !== null) {
      if (match.missingIngredients.length > filters.maxMissing) {
        continue;
      }
    } else if (!match.matches) {
      // Bez explicitního limitu rozhoduje režim párování (celé / částečné).
      continue;
    }

    entries.push({ recipe, match, score });
  }

  return sortEntries(entries, sortMode, isSearching);
}

function sortEntries(
  entries: RecipeEntry[],
  sortMode: RecipeSortMode,
  isSearching: boolean,
): RecipeEntry[] {
  if (isSearching) {
    return [...entries].sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.recipe.normalizedTitle.localeCompare(right.recipe.normalizedTitle, "cs");
    });
  }

  if (sortMode === "leastMissing") {
    return [...entries].sort((left, right) => {
      const missingDiff = left.match.missingIngredients.length - right.match.missingIngredients.length;
      if (missingDiff !== 0) {
        return missingDiff;
      }
      return left.recipe.normalizedTitle.localeCompare(right.recipe.normalizedTitle, "cs");
    });
  }

  // Ostatní režimy umí doména — seřadíme recepty a položky přerovnáme podle nich.
  const byId = new Map(entries.map((entry) => [entry.recipe.id, entry]));
  return sortRecipesBy(
    entries.map((entry) => entry.recipe),
    sortMode,
  )
    .map((recipe) => byId.get(recipe.id))
    .filter((entry): entry is RecipeEntry => entry !== undefined);
}
