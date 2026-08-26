import {
  getUnitLabel,
  normalizeText,
  scaleAmount,
  type IngredientUnit,
  type Recipe,
  type ShoppingItem,
  type ShoppingItemSource,
} from "./domain";
import {
  areUnitsCompatible,
  mergeAmounts,
  parseAmount,
  unitFamily,
  unitLabel,
  type UnitFamily,
} from "./units";

/**
 * Sestavení nákupního seznamu z receptů.
 *
 * Sloučí stejné ingredience napříč recepty (200 g mouky + 300 g mouky = 500 g),
 * přepočítá množství podle zvoleného počtu porcí a umí odečíst to, co je doma.
 * Množství, která se sečíst nedají (různé rodiny jednotek, "špetka"), zůstanou
 * vedle sebe jako text — je to poctivější než tiše zahodit jedno z nich.
 */

export type ShoppingSource = {
  recipe: Recipe;
  /** Na kolik porcí se vaří. Bez toho se použije počet uvedený v receptu. */
  servings?: number;
};

export type BuildShoppingOptions = {
  /** Ingredience, které jsou doma. */
  pantryIds?: Set<number>;
  /** Vynechat to, co je ve spíži. */
  skipPantry?: boolean;
  /** Od kterého id začít číslovat nové položky. */
  startId?: number;
  source?: ShoppingItemSource;
};

type Aggregate = {
  key: string;
  name: string;
  ingredientId: number | null;
  parts: Array<{ value: number; unit: IngredientUnit }>;
  /** Texty, které se nepodařilo převést na číslo ("špetka", "dle chuti"). */
  freeTexts: string[];
  recipeTitles: Set<string>;
};

/** Měřítko přepočtu porcí; 1, když recept počet porcí neuvádí. */
export function servingsFactor(recipe: Recipe, targetServings?: number): number {
  const base = typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
  if (base === null || !targetServings || targetServings <= 0) {
    return 1;
  }
  return targetServings / base;
}

/**
 * Poskládá položky nákupního seznamu z receptů.
 * Výsledek je seřazený abecedně podle názvu, aby se v obchodě dal číst.
 */
export function buildShoppingItems(
  sources: ShoppingSource[],
  options: BuildShoppingOptions = {},
): ShoppingItem[] {
  const { pantryIds, skipPantry = false, startId = 1, source = "recipe" } = options;
  const aggregates = new Map<string, Aggregate>();

  for (const entry of sources) {
    const factor = servingsFactor(entry.recipe, entry.servings);

    for (const ingredient of entry.recipe.ingredients) {
      if (skipPantry && ingredient.ingredientId !== null && pantryIds?.has(ingredient.ingredientId)) {
        continue;
      }

      // Ingredience bez id (ručně dopsaná) se páruje přes normalizovaný název,
      // ať se "mouka" ze dvou receptů nezaloguje dvakrát.
      const key =
        ingredient.ingredientId !== null
          ? `id:${ingredient.ingredientId}`
          : `name:${ingredient.normalizedIngredientName}`;

      let aggregate = aggregates.get(key);
      if (!aggregate) {
        aggregate = {
          key,
          name: ingredient.ingredientNameSnapshot,
          ingredientId: ingredient.ingredientId,
          parts: [],
          freeTexts: [],
          recipeTitles: new Set(),
        };
        aggregates.set(key, aggregate);
      }
      aggregate.recipeTitles.add(entry.recipe.title);

      const scaledText = factor === 1 ? ingredient.amountText : scaleAmount(ingredient.amountText, factor);
      const parsed = parseAmount(scaledText);
      if (parsed) {
        aggregate.parts.push({ value: parsed.value, unit: ingredient.unit });
      } else if (scaledText.trim().length > 0) {
        aggregate.freeTexts.push(`${scaledText.trim()} ${getUnitLabel(ingredient.unit)}`.trim());
      }
    }
  }

  let nextId = startId;
  const items = [...aggregates.values()].map((aggregate) => {
    const { amountText, unit } = summarizeAggregate(aggregate);
    const item: ShoppingItem = {
      id: nextId++,
      name: aggregate.name,
      normalizedName: normalizeText(aggregate.name),
      ingredientId: aggregate.ingredientId,
      amountText,
      unit,
      checked: false,
      source,
      recipeTitles: [...aggregate.recipeTitles],
      createdAt: new Date().toISOString(),
    };
    return item;
  });

  return sortShoppingItems(items);
}

/**
 * Shrne nasbírané kusy jednoho řádku do textu a jednotky.
 * Vrací `unit: null`, když se hodnoty sečíst nedaly — pak je celý souhrn
 * v `amountText` ("200 g + 2 lžíce") a nemá smysl mu přisuzovat jednotku.
 */
function summarizeAggregate(aggregate: Aggregate): {
  amountText: string;
  unit: IngredientUnit | null;
} {
  const compatible =
    aggregate.parts.length > 0 &&
    aggregate.parts.every((part) => areUnitsCompatible(part.unit, aggregate.parts[0].unit));

  if (compatible && aggregate.freeTexts.length === 0) {
    const merged = mergeAmounts(aggregate.parts);
    if (merged) {
      return { amountText: merged.text, unit: merged.unit };
    }
  }

  // Nesloučitelné: poskládej čitelný součet po rodinách jednotek.
  const chunks: string[] = [];
  const byFamily = new Map<UnitFamily, Array<{ value: number; unit: IngredientUnit }>>();
  for (const part of aggregate.parts) {
    const family = unitFamily(part.unit);
    const bucket = byFamily.get(family);
    if (bucket) {
      bucket.push(part);
    } else {
      byFamily.set(family, [part]);
    }
  }
  for (const bucket of byFamily.values()) {
    const merged = mergeAmounts(bucket);
    if (merged) {
      chunks.push(`${merged.text} ${unitLabel(merged.unit)}`);
    }
  }
  chunks.push(...aggregate.freeTexts);

  return { amountText: chunks.join(" + "), unit: null };
}

export function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((left, right) => {
    // Odškrtnuté klesají dolů, ať se v obchodě nepletou mezi zbývající.
    if (left.checked !== right.checked) {
      return left.checked ? 1 : -1;
    }
    return left.normalizedName.localeCompare(right.normalizedName, "cs");
  });
}

/**
 * Přidá nové položky do existujícího seznamu. Shodné položky (stejná ingredience
 * nebo stejný název) se slučují místo duplikace; odškrtnutá položka se přidáním
 * dalšího množství zase odškrtne zpátky, protože je potřeba dokoupit.
 */
export function mergeIntoShoppingList(
  existing: ShoppingItem[],
  additions: ShoppingItem[],
): ShoppingItem[] {
  const result = existing.map((item) => ({ ...item }));
  const indexByKey = new Map<string, number>();
  result.forEach((item, index) => {
    indexByKey.set(shoppingKey(item), index);
  });

  let nextId = result.reduce((max, item) => Math.max(max, item.id), 0) + 1;

  for (const addition of additions) {
    const key = shoppingKey(addition);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      result.push({ ...addition, id: nextId++ });
      indexByKey.set(key, result.length - 1);
      continue;
    }

    const current = result[existingIndex];
    result[existingIndex] = {
      ...current,
      amountText: combineAmountTexts(current, addition),
      unit: current.unit && addition.unit && current.unit === addition.unit ? current.unit : null,
      checked: false,
      recipeTitles: [
        ...new Set([...(current.recipeTitles ?? []), ...(addition.recipeTitles ?? [])]),
      ],
    };
  }

  return sortShoppingItems(result);
}

function combineAmountTexts(current: ShoppingItem, addition: ShoppingItem): string {
  if (current.amountText.trim().length === 0) {
    return addition.amountText;
  }
  if (addition.amountText.trim().length === 0) {
    return current.amountText;
  }

  const currentParsed = current.unit ? parseAmount(current.amountText) : null;
  const additionParsed = addition.unit ? parseAmount(addition.amountText) : null;

  if (currentParsed && additionParsed && current.unit && addition.unit) {
    const merged = mergeAmounts([
      { value: currentParsed.value, unit: current.unit },
      { value: additionParsed.value, unit: addition.unit },
    ]);
    if (merged) {
      // Jednotka se dorovná v `mergeIntoShoppingList`; tady vracíme jen číslo,
      // pokud jde o stejnou jednotku, jinak včetně popisku.
      return current.unit === addition.unit && merged.unit === current.unit
        ? merged.text
        : `${merged.text} ${unitLabel(merged.unit)}`;
    }
  }

  return `${formatWithUnit(current)} + ${formatWithUnit(addition)}`;
}

function formatWithUnit(item: ShoppingItem): string {
  return item.unit ? `${item.amountText} ${unitLabel(item.unit)}`.trim() : item.amountText.trim();
}

/** Klíč pro slučování — id ingredience, jinak normalizovaný název. */
function shoppingKey(item: ShoppingItem): string {
  return item.ingredientId !== null ? `id:${item.ingredientId}` : `name:${item.normalizedName}`;
}

/** Text množství i s jednotkou, připravený k zobrazení. */
export function formatShoppingAmount(item: ShoppingItem): string {
  if (item.amountText.trim().length === 0) {
    return "";
  }
  return item.unit ? `${item.amountText} ${unitLabel(item.unit)}` : item.amountText;
}

/** Nákupní seznam jako prostý text — pro sdílení do zpráv. */
export function shoppingListToText(items: ShoppingItem[]): string {
  const pending = items.filter((item) => !item.checked);
  if (pending.length === 0) {
    return "Nákupní seznam je hotový.";
  }
  const lines = pending.map((item) => {
    const amount = formatShoppingAmount(item);
    return amount.length > 0 ? `• ${item.name} — ${amount}` : `• ${item.name}`;
  });
  return ["Nákupní seznam", ...lines].join("\n");
}
