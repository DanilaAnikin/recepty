import { normalizeText, type Recipe } from "./domain";

/**
 * Vyhledávání v receptech se skórováním a tolerancí překlepů.
 *
 * Původní verze uměla jen `includes` na názvu a názvu ingredience. Tady se
 * prohledávají i štítky, popis a postup, výsledky se řadí podle relevance
 * (shoda v názvu váží víc než shoda v postupu) a překlep o jedno až dvě
 * písmena pořád najde recept — což je u české diakritiky a dlouhých slov
 * jako "bramborový" docela zásadní.
 */

/** Váha jednotlivých polí. Číslo je "cena" plné shody v daném poli. */
const FIELD_WEIGHTS = {
  title: 100,
  tag: 60,
  ingredient: 40,
  description: 18,
  step: 12,
} as const;

/** Shoda na začátku slova je silnější signál než shoda uprostřed. */
const PREFIX_BONUS = 1.2;
/** Shoda přes překlep se počítá jen částečně, ať nepřebije přesné shody. */
const FUZZY_PENALTY = 0.5;

export type RecipeSearchIndex = {
  title: string;
  tags: string[];
  ingredients: string[];
  description: string;
  steps: string[];
};

/** Předpočítaný normalizovaný index receptu — ať se normalizace nedělá pro každý dotaz znovu. */
export function buildSearchIndex(recipe: Recipe): RecipeSearchIndex {
  return {
    title: recipe.normalizedTitle,
    tags: (recipe.tags ?? []).map(normalizeText),
    ingredients: recipe.ingredients.map((item) => item.normalizedIngredientName),
    description: normalizeText(recipe.description),
    steps: (recipe.steps ?? []).map(normalizeText),
  };
}

/**
 * Levenshteinova vzdálenost s předčasným ukončením.
 * Jakmile je jisté, že překročí `maxDistance`, vrací `maxDistance + 1` —
 * u dlouhých slov to ušetří většinu práce.
 */
export function boundedEditDistance(left: string, right: string, maxDistance: number): number {
  if (left === right) {
    return 0;
  }
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }
  if (maxDistance <= 0) {
    return 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  let current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost,
      );
      if (current[j] < rowMin) {
        rowMin = current[j];
      }
    }
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[right.length];
}

/** Kolik překlepů se u daného tokenu ještě odpouští. Krátká slova žádné. */
export function allowedTypos(token: string): number {
  if (token.length >= 7) {
    return 2;
  }
  if (token.length >= 4) {
    return 1;
  }
  return 0;
}

/**
 * Skóre jednoho tokenu proti jednomu textu, v rozsahu 0..PREFIX_BONUS.
 * 0 znamená "vůbec nesedí".
 */
function matchStrength(haystack: string, token: string): number {
  if (haystack.length === 0) {
    return 0;
  }
  if (haystack.startsWith(token)) {
    return PREFIX_BONUS;
  }
  const wordStart = haystack.indexOf(` ${token}`);
  if (wordStart !== -1) {
    return PREFIX_BONUS;
  }
  if (haystack.includes(token)) {
    return 1;
  }

  const maxDistance = allowedTypos(token);
  if (maxDistance === 0) {
    return 0;
  }
  // Fuzzy porovnáváme po slovech — celá věta by od tokenu byla vždy daleko.
  for (const word of haystack.split(" ")) {
    if (word.length === 0) {
      continue;
    }
    if (boundedEditDistance(word, token, maxDistance) <= maxDistance) {
      return FUZZY_PENALTY;
    }
    // Delší slovo může token obsahovat jako začátek s překlepem
    // ("bramborovy" vs. dotaz "brambro").
    if (word.length > token.length) {
      const prefix = word.slice(0, token.length);
      if (boundedEditDistance(prefix, token, maxDistance) <= maxDistance) {
        return FUZZY_PENALTY;
      }
    }
  }
  return 0;
}

/** Nejlepší skóre tokenu napříč všemi poli receptu, už zvážené vahou pole. */
function scoreToken(index: RecipeSearchIndex, token: string): number {
  let best = 0;

  const consider = (haystack: string, weight: number) => {
    const strength = matchStrength(haystack, token);
    if (strength > 0) {
      best = Math.max(best, strength * weight);
    }
  };

  consider(index.title, FIELD_WEIGHTS.title);
  for (const tag of index.tags) {
    consider(tag, FIELD_WEIGHTS.tag);
  }
  for (const ingredient of index.ingredients) {
    consider(ingredient, FIELD_WEIGHTS.ingredient);
  }
  consider(index.description, FIELD_WEIGHTS.description);
  for (const step of index.steps) {
    consider(step, FIELD_WEIGHTS.step);
  }

  return best;
}

/**
 * Skóre receptu vůči dotazu. Vrací 0, když recept neodpovídá.
 *
 * Tokeny se vyhodnocují jako AND — "kure kari" musí najít obojí, jinak by
 * dvouslovné dotazy vracely půlku kuchařky. Prázdný dotaz dává 1, aby
 * "všechno vyhovuje" šlo odlišit od "nic nevyhovuje".
 */
export function scoreRecipe(index: RecipeSearchIndex, query: string): number {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return 1;
  }

  let total = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(index, token);
    if (tokenScore === 0) {
      return 0;
    }
    total += tokenScore;
  }

  // Průměr přes tokeny, ať dlouhý dotaz automaticky nepřebije krátký.
  return total / tokens.length;
}
