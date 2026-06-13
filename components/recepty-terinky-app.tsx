"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChefHat,
  Circle,
  Clock,
  Copy,
  Database,
  Download,
  Heart,
  HeartOff,
  ImagePlus,
  Minus,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShoppingBasket,
  Sun,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import {
  type AppState,
  type Ingredient,
  type IngredientUnit,
  type Recipe,
  type RecipeIngredient,
  type RecipeMatchMode,
  type ThemeModeOption,
  INGREDIENT_UNITS,
  RECIPE_MATCH_MODES,
  RECIPE_SORT_MODES,
  STORAGE_KEY,
  createInitialState,
  ensureSeedData,
  evaluateRecipe,
  exportStateToJson,
  firstLetter,
  getNextId,
  getUnitLabel,
  normalizeText,
  parseStoredState,
  resolveTheme,
  scaleAmount,
  serializeState,
  sortIngredients,
  sortRecipes,
  sortRecipesBy,
} from "@/lib/domain";
import { compressImageFile } from "@/lib/image";

type AppTab = "recipes" | "ingredients";
type DraftIngredientRow = {
  rowId: string;
  ingredientId: number | null;
  ingredientName: string | null;
  amountText: string;
  unit: IngredientUnit;
};

type RecipeFormState = {
  recipeId: number | null;
  title: string;
  description: string;
  imagePath: string | null;
  servings: string;
  prepTime: string;
  cookTime: string;
  tagsText: string;
  rows: DraftIngredientRow[];
};

type IngredientDialogState = {
  ingredient: Ingredient | null;
  initialName: string;
  pickerRowId: string | null;
};

export function ReceptyTerinkyApp() {
  const [appState, setAppState] = useState<AppState>(() => createInitialState());
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("recipes");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [recipeMatchMode, setRecipeMatchMode] = useState<RecipeMatchMode>("full");
  const [ingredientsQuery, setIngredientsQuery] = useState("");
  const [ingredientsFavoritesOnly, setIngredientsFavoritesOnly] = useState(false);
  const [pantryDialogOpen, setPantryDialogOpen] = useState(false);
  const [pantryDraft, setPantryDraft] = useState<number[]>([]);
  const [pantryQuery, setPantryQuery] = useState("");
  const [pantryFavoritesOnly, setPantryFavoritesOnly] = useState(false);
  const [recipeForm, setRecipeForm] = useState<RecipeFormState | null>(null);
  const [recipeDetailId, setRecipeDetailId] = useState<number | null>(null);
  const [viewServingsOverride, setViewServingsOverride] = useState<{
    recipeId: number;
    servings: number;
  } | null>(null);
  const [ingredientDialog, setIngredientDialog] = useState<IngredientDialogState | null>(null);
  const [ingredientPickerRowId, setIngredientPickerRowId] = useState<string | null>(null);
  const [ingredientPickerQuery, setIngredientPickerQuery] = useState("");
  const [ingredientPickerFavoritesOnly, setIngredientPickerFavoritesOnly] = useState(false);
  const [countEditRecipeId, setCountEditRecipeId] = useState<number | null>(null);
  const [countEditValue, setCountEditValue] = useState("0");
  const [recipesFavoritesOnly, setRecipesFavoritesOnly] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [prefersDark, setPrefersDark] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (
    message: string,
    action?: { label: string; onClick: () => void },
  ) => {
    setToast({ message, action });
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      // Záměrné: jednorázové načtení uložených dat z localStorage při mountu.
      // SSR i první klientský render používají createInitialState() (shodné -> bez
      // hydration mismatch), teprve zde se prohodí za reálná data. Standardní vzor
      // pro čtení externího (ne-React) úložiště na klientovi.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAppState(ensureSeedData(parseStoredState(window.localStorage.getItem(STORAGE_KEY))));
    } catch (error) {
      console.error("Recepty Terinky: načtení uložených dat selhalo", error);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeState(appState));
    } catch (error) {
      console.error("Recepty Terinky: zápis do localStorage selhal", error);
      // Toast jen pro skutečné překročení kvóty (báze base64 fotek je hlavní
      // příčina); ostatní vzácné chyby (SecurityError v privátním režimu apod.)
      // se jen zalogují, ať uživatele nemateme nepravdivou hláškou.
      const isQuota =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (isQuota) {
        // Záměrné: chybová zpětná vazba uživateli ve vzácné větvi. Nejde o smyčku.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        showToast("Úložiště je plné. Zálohuj data (Export) nebo uvolni místo smazáním fotek.");
      }
    }
  }, [appState, isHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemPreference = () => {
      setPrefersDark(mediaQuery.matches);
    };
    applySystemPreference();
    mediaQuery.addEventListener("change", applySystemPreference);
    return () => mediaQuery.removeEventListener("change", applySystemPreference);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const resolvedTheme = resolveTheme(appState.themeMode, prefersDark);
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [appState.themeMode, prefersDark]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), toast.action ? 5000 : 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const ingredients = appState.ingredients;
  const recipes = appState.recipes;
  const pantrySelectionSet = new Set(appState.pantrySelection);
  const selectedRecipe =
    recipeDetailId === null
      ? null
      : recipes.find((recipe) => recipe.id === recipeDetailId) ?? null;
  const detailBaseServings =
    selectedRecipe && typeof selectedRecipe.servings === "number" && selectedRecipe.servings > 0
      ? selectedRecipe.servings
      : null;
  const detailTotalTime = selectedRecipe
    ? formatTotalTime(selectedRecipe.prepTimeMinutes, selectedRecipe.cookTimeMinutes)
    : null;
  const effectiveViewServings =
    viewServingsOverride && selectedRecipe && viewServingsOverride.recipeId === selectedRecipe.id
      ? viewServingsOverride.servings
      : detailBaseServings;
  const scaleFactor =
    detailBaseServings !== null && effectiveViewServings !== null && effectiveViewServings > 0
      ? effectiveViewServings / detailBaseServings
      : 1;
  const countRecipe =
    countEditRecipeId === null
      ? null
      : recipes.find((recipe) => recipe.id === countEditRecipeId) ?? null;

  const recipeEntries = sortRecipesBy(recipes, appState.recipeSortMode)
    .filter((recipe) => !recipesFavoritesOnly || recipe.isFavorite === true)
    .map((recipe) => ({
      recipe,
      match: evaluateRecipe(recipe, pantrySelectionSet, recipeQuery, recipeMatchMode),
    }))
    .filter((entry) => entry.match.matches);

  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesQuery =
      normalizeText(ingredientsQuery).length === 0 ||
      ingredient.normalizedName.includes(normalizeText(ingredientsQuery));
    const matchesFavorite = !ingredientsFavoritesOnly || ingredient.isFavorite;
    return matchesQuery && matchesFavorite;
  });

  const groupedIngredients = filteredIngredients.reduce<
    Array<{ letter: string; items: Ingredient[] }>
  >((groups, ingredient) => {
    const lastGroup = groups.at(-1);
    if (!lastGroup || lastGroup.letter !== ingredient.firstLetter) {
      groups.push({
        letter: ingredient.firstLetter,
        items: [ingredient],
      });
      return groups;
    }
    lastGroup.items.push(ingredient);
    return groups;
  }, []);

  const pickerFilteredIngredients = ingredients.filter((ingredient) => {
    const normalizedQuery = normalizeText(ingredientPickerQuery);
    const matchesQuery =
      normalizedQuery.length === 0 || ingredient.normalizedName.includes(normalizedQuery);
    const matchesFavorite = !ingredientPickerFavoritesOnly || ingredient.isFavorite;
    return matchesQuery && matchesFavorite;
  });

  const pantryFilteredIngredients = ingredients.filter((ingredient) => {
    const normalizedQuery = normalizeText(pantryQuery);
    const matchesQuery =
      normalizedQuery.length === 0 || ingredient.normalizedName.includes(normalizedQuery);
    const matchesFavorite = !pantryFavoritesOnly || ingredient.isFavorite;
    return matchesQuery && matchesFavorite;
  });

  function updateAppState(updater: (current: AppState) => AppState) {
    setAppState((current) => ensureSeedData(updater(current)));
  }

  function setThemeMode(themeMode: ThemeModeOption) {
    updateAppState((current) => ({
      ...current,
      themeMode,
    }));
  }

  function exportBackup() {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const blob = new Blob([exportStateToJson(appState)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "recepty-terinky-zaloha.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast("Záloha stažena.");
    } catch (error) {
      console.error("Recepty Terinky: export dat selhal", error);
      showToast("Soubor se nepodařilo načíst.");
    }
  }

  async function handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const parsed = parseStoredState(text);
      setConfirmState({
        title: "Importovat data",
        message: "Nahradit současná data importem? Tvoje současná data budou přepsána.",
        confirmLabel: "Nahradit",
        onConfirm: () => {
          setAppState(ensureSeedData(parsed));
          setBackupDialogOpen(false);
          showToast("Data importována.");
        },
      });
    } catch (error) {
      console.error("Recepty Terinky: import dat selhal", error);
      showToast("Soubor se nepodařilo načíst.");
    }
  }

  function openPantryDialog() {
    setPantryDraft([...appState.pantrySelection]);
    setPantryQuery("");
    setPantryFavoritesOnly(false);
    setPantryDialogOpen(true);
  }

  function savePantrySelection() {
    updateAppState((current) => ({
      ...current,
      pantrySelection: [...pantryDraft].sort((left, right) => left - right),
    }));
    setPantryDialogOpen(false);
  }

  function toggleIngredientFavorite(ingredientId: number) {
    updateAppState((current) => ({
      ...current,
      ingredients: sortIngredients(
        current.ingredients.map((ingredient) =>
          ingredient.id === ingredientId
            ? {
                ...ingredient,
                isFavorite: !ingredient.isFavorite,
                updatedAt: new Date().toISOString(),
              }
            : ingredient,
        ),
      ),
    }));
  }

  function toggleRecipeFavorite(recipeId: number) {
    updateAppState((current) => ({
      ...current,
      recipes: sortRecipesBy(
        current.recipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                isFavorite: !(recipe.isFavorite === true),
                updatedAt: new Date().toISOString(),
              }
            : recipe,
        ),
        current.recipeSortMode,
      ),
    }));
  }

  function setRecipeSortMode(recipeSortMode: AppState["recipeSortMode"]) {
    updateAppState((current) => ({
      ...current,
      recipeSortMode,
      recipes: sortRecipesBy(current.recipes, recipeSortMode),
    }));
  }

  function duplicateRecipe(recipe: Recipe) {
    setRecipeForm({
      recipeId: null,
      title: `${recipe.title} (kopie)`,
      description: recipe.description,
      imagePath: recipe.imagePath,
      servings: typeof recipe.servings === "number" ? String(recipe.servings) : "",
      prepTime: typeof recipe.prepTimeMinutes === "number" ? String(recipe.prepTimeMinutes) : "",
      cookTime: typeof recipe.cookTimeMinutes === "number" ? String(recipe.cookTimeMinutes) : "",
      tagsText: recipe.tags && recipe.tags.length > 0 ? recipe.tags.join(", ") : "",
      rows:
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((item) => ({
              rowId: createRowId(),
              ingredientId: item.ingredientId,
              ingredientName: item.ingredientNameSnapshot,
              amountText: item.amountText,
              unit: item.unit,
            }))
          : [createDraftRow()],
    });
    setIngredientPickerRowId(null);
  }

  function saveIngredientFromDialog() {
    if (!ingredientDialog) {
      return;
    }

    const rawName = ingredientDialog.initialName.trim();
    if (rawName.length === 0) {
      showToast("Zadej název ingredience.");
      return;
    }

    const normalizedName = normalizeText(rawName);
    let savedIngredient: Ingredient | null = null;
    let errorMessage: string | null = null;

    updateAppState((current) => {
      const duplicate = current.ingredients.find((ingredient) => {
        if (ingredient.normalizedName !== normalizedName) {
          return false;
        }
        return ingredientDialog.ingredient === null || ingredient.id !== ingredientDialog.ingredient.id;
      });

      if (duplicate) {
        errorMessage = "Ingredience se stejným názvem už existuje.";
        return current;
      }

      const now = new Date().toISOString();
      if (ingredientDialog.ingredient) {
        savedIngredient = {
          ...ingredientDialog.ingredient,
          name: rawName,
          normalizedName,
          firstLetter: firstLetter(rawName),
          updatedAt: now,
        };

        return {
          ...current,
          ingredients: sortIngredients(
            current.ingredients.map((ingredient) =>
              ingredient.id === ingredientDialog.ingredient?.id ? savedIngredient! : ingredient,
            ),
          ),
        };
      }

      savedIngredient = {
        id: getNextId(current.ingredients.map((ingredient) => ingredient.id)),
        name: rawName,
        normalizedName,
        firstLetter: firstLetter(rawName),
        isFavorite: false,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...current,
        ingredients: sortIngredients([...current.ingredients, savedIngredient]),
      };
    });

    if (errorMessage) {
      showToast(errorMessage);
      return;
    }

    if (!savedIngredient) {
      return;
    }

    if (ingredientDialog.pickerRowId) {
      setRecipeForm((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          rows: current.rows.map((row) =>
            row.rowId === ingredientDialog.pickerRowId
              ? {
                  ...row,
                  ingredientId: savedIngredient?.id ?? null,
                  ingredientName: savedIngredient?.name ?? null,
                }
              : row,
          ),
        };
      });
      setIngredientPickerRowId(null);
      setIngredientPickerQuery("");
      setIngredientPickerFavoritesOnly(false);
    }

    setIngredientDialog(null);
  }

  function deleteIngredient(ingredient: Ingredient) {
    setConfirmState({
      title: "Smazat ingredienci",
      message: `Ingredience "${ingredient.name}" bude odstraněná ze seznamu.`,
      confirmLabel: "Smazat",
      onConfirm: () => {
        const wasInPantry = appState.pantrySelection.includes(ingredient.id);
        // Snapshot receptů, které ingredienci obsahují — kvůli undo i kvůli tomu,
        // aby v receptech nezůstal odkaz na neexistující ingredienci (jinak by
        // pozdější uložení takového receptu selhalo).
        const affectedRecipes = appState.recipes
          .filter((recipe) => recipe.ingredients.some((ri) => ri.ingredientId === ingredient.id))
          .map((recipe) => ({ id: recipe.id, ingredients: recipe.ingredients }));
        updateAppState((current) => ({
          ...current,
          ingredients: current.ingredients.filter((item) => item.id !== ingredient.id),
          pantrySelection: current.pantrySelection.filter((item) => item !== ingredient.id),
          recipes: current.recipes.map((recipe) =>
            recipe.ingredients.some((ri) => ri.ingredientId === ingredient.id)
              ? {
                  ...recipe,
                  ingredients: recipe.ingredients.filter(
                    (ri) => ri.ingredientId !== ingredient.id,
                  ),
                }
              : recipe,
          ),
        }));
        showToast("Ingredience byla smazaná.", {
          label: "Zpět",
          onClick: () => {
            const affectedMap = new Map(
              affectedRecipes.map((recipe) => [recipe.id, recipe.ingredients]),
            );
            updateAppState((current) => {
              if (current.ingredients.some((item) => item.id === ingredient.id)) {
                return current;
              }
              return {
                ...current,
                ingredients: sortIngredients([...current.ingredients, ingredient]),
                pantrySelection: wasInPantry
                  ? [...current.pantrySelection, ingredient.id].sort((left, right) => left - right)
                  : current.pantrySelection,
                recipes: current.recipes.map((recipe) => {
                  const restored = affectedMap.get(recipe.id);
                  return restored ? { ...recipe, ingredients: restored } : recipe;
                }),
              };
            });
            setToast(null);
          },
        });
      },
    });
  }

  function openRecipeForm(recipe?: Recipe) {
    setRecipeForm(
      recipe
        ? {
            recipeId: recipe.id,
            title: recipe.title,
            description: recipe.description,
            imagePath: recipe.imagePath,
            servings: typeof recipe.servings === "number" ? String(recipe.servings) : "",
            prepTime:
              typeof recipe.prepTimeMinutes === "number" ? String(recipe.prepTimeMinutes) : "",
            cookTime:
              typeof recipe.cookTimeMinutes === "number" ? String(recipe.cookTimeMinutes) : "",
            tagsText: recipe.tags && recipe.tags.length > 0 ? recipe.tags.join(", ") : "",
            rows:
              recipe.ingredients.length > 0
                ? recipe.ingredients.map((item) => ({
                    rowId: createRowId(),
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientNameSnapshot,
                    amountText: item.amountText,
                    unit: item.unit,
                  }))
                : [createDraftRow()],
          }
        : {
            recipeId: null,
            title: "",
            description: "",
            imagePath: null,
            servings: "",
            prepTime: "",
            cookTime: "",
            tagsText: "",
            rows: [createDraftRow()],
          },
    );
    setIngredientPickerRowId(null);
  }

  function addRecipeRowAtTop() {
    setRecipeForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        rows: [createDraftRow(), ...current.rows],
      };
    });
  }

  function removeRecipeRow(rowId: string) {
    setRecipeForm((current) => {
      if (!current || current.rows.length === 1) {
        return current;
      }
      return {
        ...current,
        rows: current.rows.filter((row) => row.rowId !== rowId),
      };
    });
  }

  function updateRecipeRow(
    rowId: string,
    updater: (row: DraftIngredientRow) => DraftIngredientRow,
  ) {
    setRecipeForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        rows: current.rows.map((row) => (row.rowId === rowId ? updater(row) : row)),
      };
    });
  }

  function pickIngredientForRow(rowId: string) {
    setIngredientPickerRowId(rowId);
    setIngredientPickerQuery("");
    setIngredientPickerFavoritesOnly(false);
  }

  function selectIngredientForRow(ingredient: Ingredient) {
    const targetRowId = ingredientPickerRowId;
    if (!targetRowId) {
      return;
    }
    updateRecipeRow(targetRowId, (row) => ({
      ...row,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
    }));
    setIngredientPickerRowId(null);
  }

  async function updateRecipeImage(file: File | null): Promise<void> {
    if (!file) {
      return;
    }
    try {
      const imagePath = await compressImageFile(file);
      setRecipeForm((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          imagePath,
        };
      });
    } catch (error) {
      console.error("Recepty Terinky: zpracování fotky selhalo", error);
      showToast("Fotku se nepodařilo načíst, zkus jinou.");
    }
  }

  function saveRecipeForm() {
    if (!recipeForm) {
      return;
    }

    if (recipeForm.title.trim().length === 0) {
      showToast("Zadej název receptu.");
      return;
    }

    const validRows = recipeForm.rows.filter((row) => row.ingredientId !== null);
    if (validRows.length === 0) {
      showToast("Přidej alespoň jednu ingredienci.");
      return;
    }

    let saved = false;
    let failureMessage: string | null = null;

    updateAppState((current) => {
      const ingredientMap = new Map(current.ingredients.map((ingredient) => [ingredient.id, ingredient]));

      const embeddedIngredients: RecipeIngredient[] = [];
      for (const row of validRows) {
        const ingredient = ingredientMap.get(row.ingredientId ?? -1);
        if (!ingredient) {
          failureMessage = "Některá ingredience už v seznamu neexistuje. Vyber ji znovu.";
          return current;
        }

        embeddedIngredients.push({
          ingredientId: ingredient.id,
          ingredientNameSnapshot: ingredient.name,
          normalizedIngredientName: ingredient.normalizedName,
          amountText: row.amountText.trim(),
          unit: row.unit,
        });
      }

      const servings = parsePositiveInt(recipeForm.servings);
      const prepTimeMinutes = parsePositiveInt(recipeForm.prepTime);
      const cookTimeMinutes = parsePositiveInt(recipeForm.cookTime);
      const tags = parseTags(recipeForm.tagsText);

      const now = new Date().toISOString();
      const recipe: Recipe = recipeForm.recipeId
        ? {
            ...(current.recipes.find((item) => item.id === recipeForm.recipeId) as Recipe),
            title: recipeForm.title.trim(),
            normalizedTitle: normalizeText(recipeForm.title),
            description: recipeForm.description.trim(),
            imagePath: recipeForm.imagePath,
            servings,
            prepTimeMinutes,
            cookTimeMinutes,
            tags,
            updatedAt: now,
            ingredients: embeddedIngredients,
          }
        : {
            id: getNextId(current.recipes.map((item) => item.id)),
            title: recipeForm.title.trim(),
            normalizedTitle: normalizeText(recipeForm.title),
            description: recipeForm.description.trim(),
            imagePath: recipeForm.imagePath,
            servings,
            prepTimeMinutes,
            cookTimeMinutes,
            tags,
            cookingCount: 0,
            createdAt: now,
            updatedAt: now,
            ingredients: embeddedIngredients,
          };

      saved = true;

      return {
        ...current,
        recipes: sortRecipes(
          recipeForm.recipeId
            ? current.recipes.map((item) => (item.id === recipe.id ? recipe : item))
            : [...current.recipes, recipe],
        ),
      };
    });

    if (failureMessage) {
      showToast(failureMessage);
      return;
    }

    if (!saved) {
      return;
    }

    setRecipeForm(null);
    showToast("Recept byl uložen.");
  }

  function deleteRecipe(recipe: Recipe) {
    setConfirmState({
      title: "Smazat recept",
      message: `Recept "${recipe.title}" bude trvale odstraněný.`,
      confirmLabel: "Smazat",
      onConfirm: () => {
        updateAppState((current) => ({
          ...current,
          recipes: current.recipes.filter((item) => item.id !== recipe.id),
        }));
        setRecipeDetailId((current) => (current === recipe.id ? null : current));
        showToast("Recept byl smazán.", {
          label: "Zpět",
          onClick: () => {
            updateAppState((current) => {
              if (current.recipes.some((item) => item.id === recipe.id)) {
                return current;
              }
              return {
                ...current,
                recipes: sortRecipesBy([...current.recipes, recipe], current.recipeSortMode),
              };
            });
            setToast(null);
          },
        });
      },
    });
  }

  function incrementCookingCount(recipeId: number) {
    updateAppState((current) => ({
      ...current,
      recipes: sortRecipes(
        current.recipes.map((recipe) =>
          recipe.id === recipeId
            ? {
                ...recipe,
                cookingCount: recipe.cookingCount + 1,
                updatedAt: new Date().toISOString(),
              }
            : recipe,
        ),
      ),
    }));
  }

  function openCountDialog(recipe: Recipe) {
    setCountEditRecipeId(recipe.id);
    setCountEditValue(String(recipe.cookingCount));
  }

  function saveCookingCount() {
    if (!countRecipe) {
      return;
    }
    const nextCount = Number.parseInt(countEditValue, 10);
    if (Number.isNaN(nextCount) || nextCount < 0) {
      showToast("Zadej celé číslo 0 nebo víc.");
      return;
    }
    updateAppState((current) => ({
      ...current,
      recipes: sortRecipes(
        current.recipes.map((recipe) =>
          recipe.id === countRecipe.id
            ? {
                ...recipe,
                cookingCount: nextCount,
                updatedAt: new Date().toISOString(),
              }
            : recipe,
        ),
      ),
    }));
    setCountEditRecipeId(null);
  }

  const themeButtonLabel =
    appState.themeMode === "system"
      ? "Podle systému"
      : appState.themeMode === "light"
        ? "Světlý režim"
        : "Tmavý režim";

  return (
    <div className="app-shell">
      <div className="background-blob blob-one" />
      <div className="background-blob blob-two" />
      <div className="background-blob blob-three" />

      <main className="app-frame">
        <section className="hero-card">
          <div className="hero-topline">
            <div className="hero-branding">
              <span className="hero-kicker">Domácí kuchařka pro každý den</span>
              <Image
                src="/branding/logo_wordmark.png"
                alt="Recepty Terinky"
                className="hero-logo"
                width={455}
                height={110}
                priority
              />
            </div>

            <div className="hero-actions">
              {appState.pantrySelection.length > 0 ? (
                <span className="status-chip">
                  <ShoppingBasket size={16} />
                  {appState.pantrySelection.length} doma
                </span>
              ) : (
                <span className="status-chip soft">Zásoby připravené k filtrování</span>
              )}
              <button
                type="button"
                className="icon-button glass"
                aria-label="Zálohy"
                onClick={() => setBackupDialogOpen(true)}
              >
                <Database size={18} />
              </button>
              <ThemeMenu
                currentMode={appState.themeMode}
                buttonLabel={themeButtonLabel}
                onSelect={setThemeMode}
              />
            </div>
          </div>

          <div className="hero-copy">
            <h1>Recepty, ingredience a domácí zásoby v jednom přehledném prostoru.</h1>
            <p>
              Najdeš rychle, co máš doma, co chceš vařit a co stojí za to uložit
              znovu. Bez chaosu a bez přepínání mezi obrazovkami, které se perou
              o pozornost.
            </p>
          </div>

          <div className="hero-bottom">
            <div className="tab-switch">
              <button
                type="button"
                className={activeTab === "recipes" ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab("recipes")}
              >
                Recepty
              </button>
              <button
                type="button"
                className={activeTab === "ingredients" ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab("ingredients")}
              >
                Ingredience
              </button>
            </div>

            <p className="hero-footnote">
              Vyladěné pro desktop i mobil, se zapamatováním theme i lokálních dat.
            </p>
          </div>
        </section>

        {activeTab === "recipes" ? (
          <section className="content-stack">
            <div className="section-intro">
              <div>
                <p className="section-eyebrow">Recepty</p>
                <h2>Co budeš vařit?</h2>
                <p>
                  Filtruj podle ingrediencí, které už máš doma, a drž si pohromadě
                  všechny oblíbené recepty.
                </p>
              </div>

              <button type="button" className="primary-button desktop-action" onClick={() => openRecipeForm()}>
                <Plus size={16} />
                Nový recept
              </button>
            </div>

            <div className="panel-card toolbar-panel">
              <div className="search-row">
                <Search size={18} />
                <input
                  value={recipeQuery}
                  onChange={(event) => setRecipeQuery(event.target.value)}
                  placeholder="Hledat recept nebo ingredienci"
                  aria-label="Vyhledat recept nebo ingredienci"
                />
                {recipeQuery ? (
                  <button
                    type="button"
                    className="icon-button ghost"
                    onClick={() => setRecipeQuery("")}
                    aria-label="Vymazat hledání"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="toolbar-wrap">
                <button type="button" className="secondary-button" onClick={openPantryDialog}>
                  <ShoppingBasket size={16} />
                  {appState.pantrySelection.length === 0
                    ? "Vybrat ingredience"
                    : "Upravit domácí zásoby"}
                </button>

                <div className="segmented-control">
                  {RECIPE_MATCH_MODES.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      className={
                        recipeMatchMode === mode.value
                          ? "segment-button active"
                          : "segment-button"
                      }
                      onClick={() => setRecipeMatchMode(mode.value)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <label className="recipe-sort-select">
                  <span className="recipe-sort-label">Řadit</span>
                  <select
                    value={appState.recipeSortMode}
                    onChange={(event) =>
                      setRecipeSortMode(event.target.value as AppState["recipeSortMode"])
                    }
                    aria-label="Řazení receptů"
                  >
                    {RECIPE_SORT_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pill-row">
                <button
                  type="button"
                  className={!recipesFavoritesOnly ? "pill-button active" : "pill-button"}
                  onClick={() => setRecipesFavoritesOnly(false)}
                >
                  Vše
                </button>
                <button
                  type="button"
                  className={recipesFavoritesOnly ? "pill-button active" : "pill-button"}
                  onClick={() => setRecipesFavoritesOnly(true)}
                >
                  Oblíbené
                </button>
              </div>
            </div>

            {recipeEntries.length === 0 ? (
              <EmptyState
                title={recipes.length === 0 ? "Zatím tu nic není" : "Nic neodpovídá filtru"}
                message={
                  recipes.length === 0
                    ? "Přidej první recept a aplikace začne fungovat naplno."
                    : recipesFavoritesOnly
                      ? "Mezi oblíbenými zatím nic není. Označ recept srdíčkem."
                      : "Zkus upravit hledání nebo výběr ingrediencí, které máš doma."
                }
                actionLabel="Přidat recept"
                onAction={() => openRecipeForm()}
              />
            ) : (
              <div className="content-stack">
                {recipeEntries.map(({ recipe, match }) => {
                  const recipeTotalTime = formatTotalTime(
                    recipe.prepTimeMinutes,
                    recipe.cookTimeMinutes,
                  );
                  const recipeHasServings =
                    typeof recipe.servings === "number" && recipe.servings > 0;
                  return (
                  <article key={recipe.id} className="recipe-card">
                    <button
                      type="button"
                      className="recipe-card-main"
                      onClick={() => setRecipeDetailId(recipe.id)}
                    >
                      <RecipeImage path={recipe.imagePath} alt={recipe.title} />

                      <div className="recipe-card-copy">
                        <h2>{recipe.title}</h2>
                        <p>{recipe.ingredients.length} ingrediencí</p>
                        {recipeTotalTime || recipeHasServings ? (
                          <div className="recipe-meta-row">
                            {recipeTotalTime ? (
                              <span className="recipe-meta-item">
                                <Clock size={13} />
                                {recipeTotalTime}
                              </span>
                            ) : null}
                            {recipeHasServings ? (
                              <span className="recipe-meta-item">
                                <Users size={13} />
                                {recipe.servings} porcí
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {recipe.tags && recipe.tags.length > 0 ? (
                          <div className="tag-chip-row">
                            {recipe.tags.map((tag) => (
                              <span key={tag} className="tag-chip">
                                <Tag size={11} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="counter-pill">
                          <span>{recipe.cookingCount}x</span>
                          <button
                            type="button"
                            className="icon-button accent"
                            onClick={(event) => {
                              event.stopPropagation();
                              incrementCookingCount(recipe.id);
                            }}
                            aria-label="Přidat vaření"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-button ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCountDialog(recipe);
                            }}
                            aria-label="Upravit počet vaření"
                          >
                            <Settings2 size={16} />
                          </button>
                        </div>
                        {recipeMatchMode === "partial" && match.missingIngredients.length > 0 ? (
                          <div className="missing-copy">
                            Chybí: {match.missingIngredients.join(", ")}
                          </div>
                        ) : null}
                      </div>
                    </button>

                    <div className="card-actions">
                      <button
                        type="button"
                        className={
                          recipe.isFavorite
                            ? "icon-button favorite active"
                            : "icon-button favorite"
                        }
                        onClick={() => toggleRecipeFavorite(recipe.id)}
                        aria-label={
                          recipe.isFavorite
                            ? "Odebrat z oblíbených"
                            : "Přidat do oblíbených"
                        }
                      >
                        {recipe.isFavorite ? <Heart size={16} /> : <HeartOff size={16} />}
                      </button>
                      <button
                        type="button"
                        className="icon-button ghost"
                        onClick={() => duplicateRecipe(recipe)}
                        aria-label="Duplikovat recept"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button ghost"
                        onClick={() => openRecipeForm(recipe)}
                        aria-label="Upravit recept"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => deleteRecipe(recipe)}
                        aria-label="Smazat recept"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}

            <button type="button" className="fab" onClick={() => openRecipeForm()}>
              <Plus size={20} />
              Nový recept
            </button>
          </section>
        ) : (
          <section className="content-stack">
            <div className="section-intro">
              <div>
                <p className="section-eyebrow">Ingredience</p>
                <h2>Seznam surovin pod kontrolou</h2>
                <p>
                  Udržuj oblíbené ingredience nahoře, upravuj názvy a doplňuj si
                  vlastní položky bez zbytečných kroků.
                </p>
              </div>

              <button
                type="button"
                className="primary-button desktop-action"
                onClick={() =>
                  setIngredientDialog({
                    ingredient: null,
                    initialName: "",
                    pickerRowId: null,
                  })
                }
              >
                <Plus size={16} />
                Nová ingredience
              </button>
            </div>

            <div className="panel-card toolbar-panel">
              <div className="search-row">
                <Search size={18} />
                <input
                  value={ingredientsQuery}
                  onChange={(event) => setIngredientsQuery(event.target.value)}
                  placeholder="Hledat ingredienci"
                  aria-label="Vyhledat ingredienci"
                />
                {ingredientsQuery ? (
                  <button
                    type="button"
                    className="icon-button ghost"
                    onClick={() => setIngredientsQuery("")}
                    aria-label="Vymazat hledání"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <div className="pill-row">
                <button
                  type="button"
                  className={!ingredientsFavoritesOnly ? "pill-button active" : "pill-button"}
                  onClick={() => setIngredientsFavoritesOnly(false)}
                >
                  Vše
                </button>
                <button
                  type="button"
                  className={ingredientsFavoritesOnly ? "pill-button active" : "pill-button"}
                  onClick={() => setIngredientsFavoritesOnly(true)}
                >
                  Oblíbené
                </button>
              </div>
            </div>

            {groupedIngredients.length === 0 ? (
              <EmptyState
                title="Nic se nenašlo"
                message="Zkus upravit hledání nebo přidej novou ingredienci."
                actionLabel="Přidat ingredienci"
                onAction={() =>
                  setIngredientDialog({
                    ingredient: null,
                    initialName: "",
                    pickerRowId: null,
                  })
                }
              />
            ) : (
              <div className="panel-card ingredient-list-card">
                {groupedIngredients.map((group) => (
                  <div key={group.letter} className="ingredient-group">
                    <h3>{group.letter}</h3>
                    <div className="ingredient-group-list">
                      {group.items.map((ingredient) => (
                        <div key={ingredient.id} className="ingredient-row">
                          <button
                            type="button"
                            className={
                              ingredient.isFavorite ? "icon-button favorite active" : "icon-button favorite"
                            }
                            onClick={() => toggleIngredientFavorite(ingredient.id)}
                            aria-label={
                              ingredient.isFavorite
                                ? "Odebrat z oblíbených"
                                : "Přidat do oblíbených"
                            }
                          >
                            {ingredient.isFavorite ? <Heart size={16} /> : <HeartOff size={16} />}
                          </button>

                          <span className="ingredient-name">{ingredient.name}</span>

                          <div className="card-actions">
                            <button
                              type="button"
                              className="icon-button ghost"
                              onClick={() =>
                                setIngredientDialog({
                                  ingredient,
                                  initialName: ingredient.name,
                                  pickerRowId: null,
                                })
                              }
                              aria-label="Upravit ingredienci"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-button danger"
                              onClick={() => deleteIngredient(ingredient)}
                              aria-label="Smazat ingredienci"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="fab"
              onClick={() =>
                setIngredientDialog({
                  ingredient: null,
                  initialName: "",
                  pickerRowId: null,
                })
              }
            >
              <Plus size={20} />
              Nová ingredience
            </button>
          </section>
        )}
      </main>

      {pantryDialogOpen ? (
        <Modal
          title="Co máš doma"
          onClose={() => setPantryDialogOpen(false)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setPantryDialogOpen(false)}>
                Zavřít
              </button>
              <button type="button" className="primary-button" onClick={savePantrySelection}>
                Uložit
              </button>
            </>
          }
        >
          <div className="content-stack compact">
            <div className="search-row">
              <Search size={18} />
              <input
                value={pantryQuery}
                onChange={(event) => setPantryQuery(event.target.value)}
                placeholder="Hledat ingredienci"
                aria-label="Vyhledat ingredienci ve spíži"
              />
              {pantryQuery ? (
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() => setPantryQuery("")}
                  aria-label="Vymazat hledání"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="pill-row">
              <button
                type="button"
                className={!pantryFavoritesOnly ? "pill-button active" : "pill-button"}
                onClick={() => setPantryFavoritesOnly(false)}
              >
                Vše
              </button>
              <button
                type="button"
                className={pantryFavoritesOnly ? "pill-button active" : "pill-button"}
                onClick={() => setPantryFavoritesOnly(true)}
              >
                Oblíbené
              </button>
              <button
                type="button"
                className="pill-button"
                onClick={() => setPantryDraft([])}
              >
                Vymazat výběr
              </button>
            </div>

            <div className="selection-list">
              {pantryFilteredIngredients.map((ingredient) => {
                const selected = pantryDraft.includes(ingredient.id);
                return (
                  <label key={ingredient.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        setPantryDraft((current) =>
                          selected
                            ? current.filter((item) => item !== ingredient.id)
                            : [...current, ingredient.id].sort((left, right) => left - right),
                        );
                      }}
                    />
                    <span>{ingredient.name}</span>
                    {ingredient.isFavorite ? <Heart size={14} /> : null}
                  </label>
                );
              })}
            </div>
          </div>
        </Modal>
      ) : null}

      {ingredientDialog ? (
        <Modal
          title={ingredientDialog.ingredient ? "Upravit ingredienci" : "Nová ingredience"}
          onClose={() => setIngredientDialog(null)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setIngredientDialog(null)}>
                Zrušit
              </button>
              <button type="button" className="primary-button" onClick={saveIngredientFromDialog}>
                Uložit
              </button>
            </>
          }
        >
          <label className="field-stack">
            <span>Název ingredience</span>
            <input
              autoFocus
              value={ingredientDialog.initialName}
              onChange={(event) =>
                setIngredientDialog((current) =>
                  current
                    ? {
                        ...current,
                        initialName: event.target.value,
                      }
                    : current,
                )
              }
            />
          </label>
        </Modal>
      ) : null}

      {ingredientPickerRowId ? (
        <Modal
          title="Vyber ingredienci"
          onClose={() => setIngredientPickerRowId(null)}
          footer={
            <button type="button" className="secondary-button" onClick={() => setIngredientPickerRowId(null)}>
              Zavřít
            </button>
          }
        >
          <div className="content-stack compact">
            <div className="search-row">
              <Search size={18} />
              <input
                value={ingredientPickerQuery}
                onChange={(event) => setIngredientPickerQuery(event.target.value)}
                placeholder="Hledat ingredienci"
                aria-label="Vyhledat ingredienci"
              />
              {ingredientPickerQuery ? (
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() => setIngredientPickerQuery("")}
                  aria-label="Vymazat hledání"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="pill-row">
              <button
                type="button"
                className={!ingredientPickerFavoritesOnly ? "pill-button active" : "pill-button"}
                onClick={() => setIngredientPickerFavoritesOnly(false)}
              >
                Vše
              </button>
              <button
                type="button"
                className={ingredientPickerFavoritesOnly ? "pill-button active" : "pill-button"}
                onClick={() => setIngredientPickerFavoritesOnly(true)}
              >
                Oblíbené
              </button>
            </div>

            <button
              type="button"
              className="secondary-button align-start"
              onClick={() =>
                setIngredientDialog({
                  ingredient: null,
                  initialName: ingredientPickerQuery.trim(),
                  pickerRowId: ingredientPickerRowId,
                })
              }
            >
              <Plus size={16} />
              {normalizeText(ingredientPickerQuery).length > 0
                ? `Vytvořit "${ingredientPickerQuery.trim()}"`
                : "Nová ingredience"}
            </button>

            {pickerFilteredIngredients.length === 0 ? (
              <p className="muted-copy">
                {normalizeText(ingredientPickerQuery).length === 0
                  ? "Zatím tu nejsou žádné ingredience."
                  : "Nic nenalezeno. Ingredienci můžeš rovnou vytvořit."}
              </p>
            ) : (
              <div className="selection-list">
                {pickerFilteredIngredients.map((ingredient) => (
                  <button
                    key={ingredient.id}
                    type="button"
                    className="picker-row"
                    onClick={() => selectIngredientForRow(ingredient)}
                  >
                    <span>{ingredient.name}</span>
                    {ingredient.isFavorite ? <Heart size={14} /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {recipeForm ? (
        <Modal
          title={recipeForm.recipeId ? "Upravit recept" : "Nový recept"}
          onClose={() => setRecipeForm(null)}
          size="wide"
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setRecipeForm(null)}>
                Zavřít
              </button>
              <button type="button" className="primary-button" onClick={saveRecipeForm}>
                Uložit recept
              </button>
            </>
          }
        >
          <div className="content-stack">
            <section className="form-card">
              <label className="field-stack">
                <span>Název receptu</span>
                <input
                  value={recipeForm.title}
                  onChange={(event) =>
                    setRecipeForm((current) =>
                      current
                        ? {
                            ...current,
                            title: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>

              <label className="field-stack">
                <span>Postup nebo poznámka</span>
                <textarea
                  rows={5}
                  value={recipeForm.description}
                  onChange={(event) =>
                    setRecipeForm((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>

              <div className="inline-fields">
                <label className="field-stack">
                  <span>Počet porcí</span>
                  <input
                    inputMode="numeric"
                    value={recipeForm.servings}
                    onChange={(event) =>
                      setRecipeForm((current) =>
                        current
                          ? {
                              ...current,
                              servings: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Příprava (min)</span>
                  <input
                    inputMode="numeric"
                    value={recipeForm.prepTime}
                    onChange={(event) =>
                      setRecipeForm((current) =>
                        current
                          ? {
                              ...current,
                              prepTime: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </label>

                <label className="field-stack">
                  <span>Vaření (min)</span>
                  <input
                    inputMode="numeric"
                    value={recipeForm.cookTime}
                    onChange={(event) =>
                      setRecipeForm((current) =>
                        current
                          ? {
                              ...current,
                              cookTime: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </label>
              </div>

              <label className="field-stack">
                <span>Štítky (oddělené čárkou)</span>
                <input
                  value={recipeForm.tagsText}
                  placeholder="např. večeře, rychlé, bezlepkové"
                  onChange={(event) =>
                    setRecipeForm((current) =>
                      current
                        ? {
                            ...current,
                            tagsText: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </label>

              <div className="image-tools">
                <RecipeImage path={recipeForm.imagePath} alt="Náhled fotky receptu" large />
                <label className="secondary-button file-button">
                  <ImagePlus size={16} />
                  Vybrat fotku
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const input = event.target;
                      void updateRecipeImage(input.files?.[0] ?? null).finally(() => {
                        input.value = "";
                      });
                    }}
                  />
                </label>
                {recipeForm.imagePath ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setRecipeForm((current) =>
                        current
                          ? {
                              ...current,
                              imagePath: null,
                            }
                          : current,
                      )
                    }
                  >
                    Odebrat fotku
                  </button>
                ) : null}
              </div>
            </section>

            <section className="form-card">
              <div className="section-header">
                <h3>Ingredience</h3>
                <button type="button" className="secondary-button" onClick={addRecipeRowAtTop}>
                  <Plus size={16} />
                  Přidat řádek
                </button>
              </div>

              <div className="content-stack compact">
                {recipeForm.rows.map((row) => (
                  <div key={row.rowId} className="ingredient-form-row">
                    <button
                      type="button"
                      className="ingredient-pick-button"
                      onClick={() => pickIngredientForRow(row.rowId)}
                      aria-label={`Vybrat ingredienci: ${row.ingredientName ?? "zatím nevybráno"}`}
                    >
                      <div>
                        <strong>{row.ingredientName ?? "Vyber ingredienci"}</strong>
                        {!row.ingredientName ? (
                          <span>Klepni a vyber nebo vytvoř ingredienci</span>
                        ) : null}
                      </div>
                    </button>

                    <div className="inline-fields">
                      <label className="field-stack">
                        <span>Množství</span>
                        <input
                          value={row.amountText}
                          onChange={(event) =>
                            updateRecipeRow(row.rowId, (current) => ({
                              ...current,
                              amountText: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="field-stack">
                        <span>Jednotka</span>
                        <select
                          value={row.unit}
                          onChange={(event) =>
                            updateRecipeRow(row.rowId, (current) => ({
                              ...current,
                              unit: event.target.value as IngredientUnit,
                            }))
                          }
                        >
                          {INGREDIENT_UNITS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => removeRecipeRow(row.rowId)}
                        disabled={recipeForm.rows.length === 1}
                        aria-label="Odebrat řádek"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Modal>
      ) : null}

      {selectedRecipe ? (
        <Modal
          title="Detail receptu"
          onClose={() => setRecipeDetailId(null)}
          size="wide"
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setRecipeDetailId(null)}>
                Zavřít
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  openRecipeForm(selectedRecipe);
                  setRecipeDetailId(null);
                }}
              >
                Upravit
              </button>
              <button
                type="button"
                className="primary-button danger-fill"
                onClick={() => deleteRecipe(selectedRecipe)}
              >
                Smazat
              </button>
            </>
          }
        >
          <div className="content-stack">
            <section className="detail-hero">
              <div className="content-stack compact grow">
                <h2 className="detail-title">{selectedRecipe.title}</h2>
                <div className="meta-row">
                  <span className="meta-chip">
                    <ChefHat size={16} />
                    {selectedRecipe.ingredients.length} ingrediencí
                  </span>
                  <span className="meta-chip">
                    <Heart size={16} />
                    {selectedRecipe.cookingCount}x uvařeno
                  </span>
                  {detailTotalTime ? (
                    <span className="meta-chip">
                      <Clock size={16} />
                      {detailTotalTime}
                    </span>
                  ) : null}
                  {typeof selectedRecipe.servings === "number" && selectedRecipe.servings > 0 ? (
                    <span className="meta-chip">
                      <Users size={16} />
                      {selectedRecipe.servings} porcí
                    </span>
                  ) : null}
                </div>
                {selectedRecipe.tags && selectedRecipe.tags.length > 0 ? (
                  <div className="tag-chip-row">
                    {selectedRecipe.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        <Tag size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="toolbar-wrap">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => incrementCookingCount(selectedRecipe.id)}
                  >
                    <Plus size={16} />
                    Přidat vaření
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openCountDialog(selectedRecipe)}
                  >
                    <Settings2 size={16} />
                    Upravit počet
                  </button>
                  <button
                    type="button"
                    className={
                      selectedRecipe.isFavorite
                        ? "secondary-button favorite-button active"
                        : "secondary-button favorite-button"
                    }
                    onClick={() => toggleRecipeFavorite(selectedRecipe.id)}
                  >
                    {selectedRecipe.isFavorite ? <Heart size={16} /> : <HeartOff size={16} />}
                    {selectedRecipe.isFavorite ? "V oblíbených" : "Do oblíbených"}
                  </button>
                </div>
              </div>

              <RecipeImage path={selectedRecipe.imagePath} alt={selectedRecipe.title} large />
            </section>

            <section className="form-card">
              <div className="section-header">
                <h3>Ingredience</h3>
                {detailBaseServings !== null && effectiveViewServings !== null ? (
                  <div className="servings-stepper">
                    <span className="servings-stepper-label">Porce</span>
                    <button
                      type="button"
                      className="icon-button ghost"
                      onClick={() =>
                        setViewServingsOverride({
                          recipeId: selectedRecipe.id,
                          servings: Math.max(1, effectiveViewServings - 1),
                        })
                      }
                      disabled={effectiveViewServings <= 1}
                      aria-label="Méně porcí"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="servings-stepper-value">{effectiveViewServings}</span>
                    <button
                      type="button"
                      className="icon-button ghost"
                      onClick={() =>
                        setViewServingsOverride({
                          recipeId: selectedRecipe.id,
                          servings: effectiveViewServings + 1,
                        })
                      }
                      aria-label="Více porcí"
                    >
                      <Plus size={16} />
                    </button>
                    {effectiveViewServings !== detailBaseServings ? (
                      <button
                        type="button"
                        className="icon-button ghost"
                        onClick={() => setViewServingsOverride(null)}
                        aria-label="Obnovit původní počet porcí"
                      >
                        <RotateCcw size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="ingredient-lines">
                {selectedRecipe.ingredients.map((ingredient, index) => {
                  const displayedAmount =
                    scaleFactor !== 1
                      ? scaleAmount(ingredient.amountText, scaleFactor)
                      : ingredient.amountText;
                  return (
                    <div
                      key={`${ingredient.ingredientId ?? "custom"}-${index}`}
                      className="ingredient-line"
                    >
                      <Circle size={8} />
                      <span>
                        {ingredient.ingredientNameSnapshot}
                        {ingredient.amountText.trim().length > 0
                          ? ` - ${displayedAmount} ${getUnitLabel(ingredient.unit)}`
                          : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="form-card">
              <h3>Postup</h3>
              <p className="multiline-copy">
                {selectedRecipe.description.trim().length > 0
                  ? selectedRecipe.description
                  : "Zatím bez postupu."}
              </p>
            </section>
          </div>
        </Modal>
      ) : null}

      {countRecipe ? (
        <Modal
          title="Upravit počet vaření"
          onClose={() => setCountEditRecipeId(null)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setCountEditRecipeId(null)}>
                Zrušit
              </button>
              <button type="button" className="primary-button" onClick={saveCookingCount}>
                Uložit
              </button>
            </>
          }
        >
          <label className="field-stack">
            <span>Počet vaření</span>
            <input
              inputMode="numeric"
              value={countEditValue}
              onChange={(event) => setCountEditValue(event.target.value)}
            />
          </label>
        </Modal>
      ) : null}

      {backupDialogOpen ? (
        <Modal
          title="Zálohování dat"
          onClose={() => setBackupDialogOpen(false)}
          footer={
            <button type="button" className="secondary-button" onClick={() => setBackupDialogOpen(false)}>
              Zavřít
            </button>
          }
        >
          <div className="content-stack compact">
            <p className="muted-copy">
              Stáhni si zálohu všech receptů, ingrediencí a zásob, nebo nahraj dříve
              uloženou zálohu zpět do aplikace.
            </p>
            <div className="backup-actions">
              <button type="button" className="primary-button" onClick={exportBackup}>
                <Download size={16} />
                Stáhnout zálohu
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={16} />
                Nahrát zálohu
              </button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="backup-file-input"
              onChange={(event) => {
                const input = event.target;
                const file = input.files?.[0];
                if (file) {
                  void handleImportFile(file).finally(() => {
                    input.value = "";
                  });
                } else {
                  input.value = "";
                }
              }}
            />
          </div>
        </Modal>
      ) : null}

      {confirmState ? (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            action();
          }}
        />
      ) : null}

      <nav className="bottom-nav">
        <button
          type="button"
          className={activeTab === "recipes" ? "bottom-nav-button active" : "bottom-nav-button"}
          onClick={() => setActiveTab("recipes")}
        >
          <ChefHat size={18} />
          Recepty
        </button>
        <button
          type="button"
          className={activeTab === "ingredients" ? "bottom-nav-button active" : "bottom-nav-button"}
          onClick={() => setActiveTab("ingredients")}
        >
          <ShoppingBasket size={18} />
          Ingredience
        </button>
      </nav>

      {toast ? (
        <div className="toast">
          <span className="toast-message">{toast.message}</span>
          {toast.action ? (
            <button
              type="button"
              className="toast-action"
              onClick={toast.action.onClick}
            >
              <RotateCcw size={14} />
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isHydrated ? <div className="boot-indicator">Načítám uložená data…</div> : null}
    </div>
  );
}

function ThemeMenu({
  currentMode,
  buttonLabel,
  onSelect,
}: {
  currentMode: ThemeModeOption;
  buttonLabel: string;
  onSelect: (themeMode: ThemeModeOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleMouseDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={wrapperRef}>
      <button
        type="button"
        className="icon-button glass"
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="theme-menu-panel"
        onClick={() => setOpen((current) => !current)}
      >
        {currentMode === "dark" ? <Moon size={18} /> : currentMode === "light" ? <Sun size={18} /> : <Settings2 size={18} />}
      </button>
      {open ? (
        <div className="theme-menu-panel" id="theme-menu-panel">
          <button type="button" onClick={() => { onSelect("system"); setOpen(false); }}>
            <Settings2 size={16} />
            Podle systému
          </button>
          <button type="button" onClick={() => { onSelect("light"); setOpen(false); }}>
            <Sun size={16} />
            Světlý režim
          </button>
          <button type="button" onClick={() => { onSelect("dark"); setOpen(false); }}>
            <Moon size={16} />
            Tmavý režim
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <ChefHat size={36} />
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onAction}>
        <Plus size={16} />
        {actionLabel}
      </button>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({
  title,
  onClose,
  children,
  footer,
  size = "regular",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "regular" | "wide";
}) {
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalNode = windowRef.current;
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;

    if (modalNode) {
      const focusable = modalNode.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? modalNode).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modalNode) {
        return;
      }
      const focusableElements = Array.from(
        modalNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        modalNode.focus();
        return;
      }
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || active === modalNode) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // Listener na vlastním uzlu modalu (ne na document): u stackovaných modalů
    // má fokus jen ten nejvrchnější, takže Escape/Tab obslouží pouze on a ostatní
    // modaly se nezavřou společně s ním.
    modalNode?.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      modalNode?.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // Mount/unmount lifecycle modalu: onClose je po dobu života modalu stabilní,
    // dep array je záměrně prázdný (jinak by inline closury z rodiče způsobovaly
    // zbytečný re-setup efektu při každém re-renderu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={windowRef}
        className={size === "wide" ? "modal-window wide" : "modal-window"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button ghost" onClick={onClose} aria-label="Zavřít">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Zrušit
          </button>
          <button type="button" className="primary-button danger-fill" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">
        <AlertTriangle size={20} className="confirm-icon" />
        <p className="confirm-message">{message}</p>
      </div>
    </Modal>
  );
}

function RecipeImage({
  path,
  alt,
  large = false,
}: {
  path: string | null;
  alt: string;
  large?: boolean;
}) {
  return (
    <div className={large ? "recipe-image large" : "recipe-image"}>
      {path ? (
        <Image
          src={path}
          alt={alt}
          fill
          sizes={large ? "132px" : "96px"}
          unoptimized
        />
      ) : (
        <ChefHat size={large ? 42 : 28} />
      )}
    </div>
  );
}

function createDraftRow(): DraftIngredientRow {
  return {
    rowId: createRowId(),
    ingredientId: null,
    ingredientName: null,
    amountText: "",
    unit: "ks",
  };
}

function createRowId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parsePositiveInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(",")) {
    const tag = raw.trim();
    if (tag.length === 0) {
      continue;
    }
    const key = normalizeText(tag);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function formatTotalTime(prep?: number, cook?: number): string | null {
  const total = (typeof prep === "number" ? prep : 0) + (typeof cook === "number" ? cook : 0);
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
