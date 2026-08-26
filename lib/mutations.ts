import {
  firstLetter,
  getNextId,
  normalizeText,
  prettifyIngredientName,
  sortIngredients,
  sortPantry,
  sortRecipes,
  type AppState,
  type CookLogEntry,
  type Ingredient,
  type MealPlanEntry,
  type PantryItem,
  type Recipe,
  type ShoppingItem,
} from "./domain";
import { mergeIntoShoppingList, sortShoppingItems } from "./shopping";

/**
 * Čisté úpravy stavu.
 *
 * Všechno, co v aplikaci mění data, prochází těmito funkcemi. Díky tomu jde
 * chování otestovat bez Reactu a komponentám zbývá jen `commit(mutations.x)`.
 * Žádná z funkcí nemutuje vstup — reducer na tom staví historii Zpět/Znovu.
 */

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Recepty
// ---------------------------------------------------------------------------

export function upsertRecipe(state: AppState, recipe: Recipe): AppState {
  const exists = state.recipes.some((item) => item.id === recipe.id);
  const normalized: Recipe = {
    ...recipe,
    normalizedTitle: normalizeText(recipe.title),
    updatedAt: nowIso(),
  };

  return {
    ...state,
    recipes: sortRecipes(
      exists
        ? state.recipes.map((item) => (item.id === recipe.id ? normalized : item))
        : [...state.recipes, normalized],
    ),
  };
}

export function nextRecipeId(state: AppState): number {
  return getNextId(state.recipes.map((recipe) => recipe.id));
}

export function deleteRecipe(state: AppState, recipeId: number): AppState {
  return {
    ...state,
    recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
    // Plán nesmí zůstat viset na smazaném receptu.
    mealPlan: state.mealPlan.filter((entry) => entry.recipeId !== recipeId),
  };
}

export function duplicateRecipe(state: AppState, recipeId: number): AppState {
  const source = state.recipes.find((recipe) => recipe.id === recipeId);
  if (!source) {
    return state;
  }

  const title = uniqueCopyTitle(state, source.title);
  const timestamp = nowIso();

  const copy: Recipe = {
    ...source,
    id: nextRecipeId(state),
    title,
    normalizedTitle: normalizeText(title),
    createdAt: timestamp,
    updatedAt: timestamp,
    // Kopie začíná s čistým štítem — počty vaření a historie patří originálu.
    cookingCount: 0,
    cookLog: [],
    isFavorite: false,
  };

  return { ...state, recipes: sortRecipes([...state.recipes, copy]) };
}

/** "Guláš" -> "Guláš (kopie)" -> "Guláš (kopie 2)" … */
function uniqueCopyTitle(state: AppState, baseTitle: string): string {
  const existing = new Set(state.recipes.map((recipe) => recipe.normalizedTitle));
  const first = `${baseTitle} (kopie)`;
  if (!existing.has(normalizeText(first))) {
    return first;
  }
  for (let index = 2; index < 500; index += 1) {
    const candidate = `${baseTitle} (kopie ${index})`;
    if (!existing.has(normalizeText(candidate))) {
      return candidate;
    }
  }
  return `${baseTitle} (kopie ${Date.now()})`;
}

export function toggleRecipeFavorite(state: AppState, recipeId: number): AppState {
  return mapRecipe(state, recipeId, (recipe) => ({
    ...recipe,
    isFavorite: recipe.isFavorite !== true,
  }));
}

export function setRecipeNotes(state: AppState, recipeId: number, notes: string): AppState {
  return mapRecipe(state, recipeId, (recipe) => ({
    ...recipe,
    notes: notes.trim().length > 0 ? notes : undefined,
  }));
}

export function setRecipeRating(state: AppState, recipeId: number, rating: number): AppState {
  return mapRecipe(state, recipeId, (recipe) => ({
    ...recipe,
    rating: rating >= 1 && rating <= 5 ? rating : undefined,
  }));
}

export function setCookingCount(state: AppState, recipeId: number, count: number): AppState {
  return mapRecipe(state, recipeId, (recipe) => ({
    ...recipe,
    cookingCount: Math.max(0, Math.floor(count)),
  }));
}

/**
 * Zapíše uvaření do historie a zvýší počítadlo.
 * `cookingCount` se drží jako rychlý souhrn — historie může být dlouhá a
 * počítat ji při každém řazení by bylo zbytečné.
 */
export function addCookLogEntry(
  state: AppState,
  recipeId: number,
  entry: Omit<CookLogEntry, "id">,
): AppState {
  return mapRecipe(state, recipeId, (recipe) => {
    const log = recipe.cookLog ?? [];
    const newEntry: CookLogEntry = { ...entry, id: getNextId(log.map((item) => item.id)) };
    return {
      ...recipe,
      cookingCount: recipe.cookingCount + 1,
      cookLog: [...log, newEntry],
    };
  });
}

export function removeCookLogEntry(state: AppState, recipeId: number, entryId: number): AppState {
  return mapRecipe(state, recipeId, (recipe) => ({
    ...recipe,
    cookingCount: Math.max(0, recipe.cookingCount - 1),
    cookLog: (recipe.cookLog ?? []).filter((entry) => entry.id !== entryId),
  }));
}

function mapRecipe(
  state: AppState,
  recipeId: number,
  update: (recipe: Recipe) => Recipe,
): AppState {
  return {
    ...state,
    recipes: state.recipes.map((recipe) =>
      recipe.id === recipeId ? { ...update(recipe), updatedAt: nowIso() } : recipe,
    ),
  };
}

// ---------------------------------------------------------------------------
// Ingredience
// ---------------------------------------------------------------------------

export function addIngredient(state: AppState, rawName: string): { state: AppState; ingredient: Ingredient } {
  const normalizedName = normalizeText(rawName);
  const existing = state.ingredients.find((item) => item.normalizedName === normalizedName);
  if (existing) {
    return { state, ingredient: existing };
  }

  const timestamp = nowIso();
  const ingredient: Ingredient = {
    id: getNextId(state.ingredients.map((item) => item.id)),
    normalizedName,
    name: prettifyIngredientName(rawName),
    firstLetter: firstLetter(rawName),
    isFavorite: false,
    isSystem: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    state: { ...state, ingredients: sortIngredients([...state.ingredients, ingredient]) },
    ingredient,
  };
}

export function renameIngredient(state: AppState, ingredientId: number, rawName: string): AppState {
  const normalizedName = normalizeText(rawName);
  const name = prettifyIngredientName(rawName);

  return {
    ...state,
    ingredients: sortIngredients(
      state.ingredients.map((item) =>
        item.id === ingredientId
          ? {
              ...item,
              name,
              normalizedName,
              firstLetter: firstLetter(rawName),
              updatedAt: nowIso(),
            }
          : item,
      ),
    ),
    // Recepty si nesou vlastní kopii názvu — po přejmenování se musí srovnat,
    // jinak by v receptu zůstal starý název.
    recipes: state.recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((line) =>
        line.ingredientId === ingredientId
          ? { ...line, ingredientNameSnapshot: name, normalizedIngredientName: normalizedName }
          : line,
      ),
    })),
  };
}

export function toggleIngredientFavorite(state: AppState, ingredientId: number): AppState {
  return {
    ...state,
    ingredients: state.ingredients.map((item) =>
      item.id === ingredientId
        ? { ...item, isFavorite: !item.isFavorite, updatedAt: nowIso() }
        : item,
    ),
  };
}

/** Kolik receptů danou ingredienci používá — kvůli varování před smazáním. */
export function countRecipesUsingIngredient(state: AppState, ingredientId: number): number {
  return state.recipes.filter((recipe) =>
    recipe.ingredients.some((line) => line.ingredientId === ingredientId),
  ).length;
}

/**
 * Smaže ingredienci a uklidí za ní.
 *
 * Řádky v receptech se nemažou — jen ztratí vazbu (`ingredientId: null`).
 * Recept si tak zachová informaci "tohle tam patří", i když ingredience
 * v seznamu už není.
 */
export function deleteIngredient(state: AppState, ingredientId: number): AppState {
  return {
    ...state,
    ingredients: state.ingredients.filter((item) => item.id !== ingredientId),
    recipes: state.recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((line) =>
        line.ingredientId === ingredientId ? { ...line, ingredientId: null } : line,
      ),
    })),
    pantry: state.pantry.filter((item) => item.ingredientId !== ingredientId),
    shoppingList: state.shoppingList.map((item) =>
      item.ingredientId === ingredientId ? { ...item, ingredientId: null } : item,
    ),
  };
}

// ---------------------------------------------------------------------------
// Zásoby
// ---------------------------------------------------------------------------

export function setPantryItem(state: AppState, item: PantryItem): AppState {
  const exists = state.pantry.some((entry) => entry.ingredientId === item.ingredientId);
  const stamped = { ...item, updatedAt: nowIso() };

  return {
    ...state,
    pantry: sortPantry(
      exists
        ? state.pantry.map((entry) => (entry.ingredientId === item.ingredientId ? stamped : entry))
        : [...state.pantry, stamped],
    ),
  };
}

export function removePantryItem(state: AppState, ingredientId: number): AppState {
  return {
    ...state,
    pantry: state.pantry.filter((entry) => entry.ingredientId !== ingredientId),
  };
}

export function togglePantryItem(state: AppState, ingredientId: number): AppState {
  return state.pantry.some((entry) => entry.ingredientId === ingredientId)
    ? removePantryItem(state, ingredientId)
    : setPantryItem(state, { ingredientId, updatedAt: nowIso() });
}

/** Nastaví celý obsah spíže naráz — používá dialog "Co máš doma". */
export function replacePantry(state: AppState, ingredientIds: number[]): AppState {
  const existing = new Map(state.pantry.map((item) => [item.ingredientId, item]));
  const timestamp = nowIso();

  return {
    ...state,
    pantry: sortPantry(
      ingredientIds.map(
        (ingredientId) =>
          // Množství a expiraci u už uložených položek zachováme.
          existing.get(ingredientId) ?? { ingredientId, updatedAt: timestamp },
      ),
    ),
  };
}

// ---------------------------------------------------------------------------
// Nákupní seznam
// ---------------------------------------------------------------------------

export function addShoppingItems(state: AppState, items: ShoppingItem[]): AppState {
  return { ...state, shoppingList: mergeIntoShoppingList(state.shoppingList, items) };
}

export function addManualShoppingItem(state: AppState, name: string): AppState {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return state;
  }

  const item: ShoppingItem = {
    id: getNextId(state.shoppingList.map((entry) => entry.id)),
    name: trimmed,
    normalizedName: normalizeText(trimmed),
    ingredientId:
      state.ingredients.find((entry) => entry.normalizedName === normalizeText(trimmed))?.id ?? null,
    amountText: "",
    unit: null,
    checked: false,
    source: "manual",
    createdAt: nowIso(),
  };

  return addShoppingItems(state, [item]);
}

export function toggleShoppingItem(state: AppState, itemId: number): AppState {
  return {
    ...state,
    shoppingList: sortShoppingItems(
      state.shoppingList.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      ),
    ),
  };
}

export function removeShoppingItem(state: AppState, itemId: number): AppState {
  return { ...state, shoppingList: state.shoppingList.filter((item) => item.id !== itemId) };
}

export function clearCheckedShoppingItems(state: AppState): AppState {
  return { ...state, shoppingList: state.shoppingList.filter((item) => !item.checked) };
}

export function clearShoppingList(state: AppState): AppState {
  return { ...state, shoppingList: [] };
}

/**
 * Odškrtnuté položky přesune do spíže — po nákupu je člověk fakt doma.
 * Položky bez vazby na ingredienci se jen smažou; do spíže je zařadit nejde.
 */
export function moveCheckedToPantry(state: AppState): AppState {
  const checked = state.shoppingList.filter((item) => item.checked);
  const timestamp = nowIso();

  let next = state;
  for (const item of checked) {
    if (item.ingredientId === null) {
      continue;
    }
    next = setPantryItem(next, {
      ingredientId: item.ingredientId,
      quantity: item.amountText.trim().length > 0 ? item.amountText : undefined,
      unit: item.unit ?? undefined,
      updatedAt: timestamp,
    });
  }

  return clearCheckedShoppingItems(next);
}

// ---------------------------------------------------------------------------
// Plánovač
// ---------------------------------------------------------------------------

export function upsertMealPlanEntry(state: AppState, entry: MealPlanEntry): AppState {
  const exists = state.mealPlan.some((item) => item.id === entry.id);
  return {
    ...state,
    mealPlan: exists
      ? state.mealPlan.map((item) => (item.id === entry.id ? entry : item))
      : [...state.mealPlan, entry],
  };
}

export function addMealPlanEntry(
  state: AppState,
  entry: Omit<MealPlanEntry, "id">,
): AppState {
  return upsertMealPlanEntry(state, {
    ...entry,
    id: getNextId(state.mealPlan.map((item) => item.id)),
  });
}

export function removeMealPlanEntry(state: AppState, entryId: number): AppState {
  return { ...state, mealPlan: state.mealPlan.filter((item) => item.id !== entryId) };
}

/** Vyprázdní jeden týden plánu (včetně krajních dnů). */
export function clearMealPlanRange(state: AppState, fromDate: string, toDate: string): AppState {
  return {
    ...state,
    mealPlan: state.mealPlan.filter((entry) => entry.date < fromDate || entry.date > toDate),
  };
}

// ---------------------------------------------------------------------------
// Nastavení
// ---------------------------------------------------------------------------

export function setThemeMode(state: AppState, themeMode: AppState["themeMode"]): AppState {
  return { ...state, themeMode };
}

export function setRecipeSortMode(state: AppState, recipeSortMode: AppState["recipeSortMode"]): AppState {
  return { ...state, recipeSortMode };
}

export function setSyncSettings(state: AppState, sync: Partial<AppState["sync"]>): AppState {
  return { ...state, sync: { ...state.sync, ...sync } };
}

export function markBackupTaken(state: AppState): AppState {
  return { ...state, lastBackupAt: nowIso() };
}
