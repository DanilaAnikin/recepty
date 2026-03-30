"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ChefHat,
  Circle,
  Heart,
  HeartOff,
  ImagePlus,
  Moon,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShoppingBasket,
  Sun,
  Trash2,
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
  STORAGE_KEY,
  createInitialState,
  ensureSeedData,
  evaluateRecipe,
  firstLetter,
  getNextId,
  getUnitLabel,
  normalizeText,
  parseStoredState,
  resolveTheme,
  serializeState,
  sortIngredients,
  sortRecipes,
} from "@/lib/domain";

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
  rows: DraftIngredientRow[];
};

type IngredientDialogState = {
  ingredient: Ingredient | null;
  initialName: string;
  pickerRowId: string | null;
};

export function ReceptyTerinkyApp() {
  const [appState, setAppState] = useState<AppState>(() => {
    if (typeof window === "undefined") {
      return createInitialState();
    }
    return ensureSeedData(parseStoredState(window.localStorage.getItem(STORAGE_KEY)));
  });
  const [isHydrated, setIsHydrated] = useState(() => typeof window !== "undefined");
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
  const [ingredientDialog, setIngredientDialog] = useState<IngredientDialogState | null>(null);
  const [ingredientPickerRowId, setIngredientPickerRowId] = useState<string | null>(null);
  const [ingredientPickerQuery, setIngredientPickerQuery] = useState("");
  const [ingredientPickerFavoritesOnly, setIngredientPickerFavoritesOnly] = useState(false);
  const [countEditRecipeId, setCountEditRecipeId] = useState<number | null>(null);
  const [countEditValue, setCountEditValue] = useState("0");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, serializeState(appState));
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
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const ingredients = appState.ingredients;
  const recipes = appState.recipes;
  const pantrySelectionSet = new Set(appState.pantrySelection);
  const selectedRecipe =
    recipeDetailId === null
      ? null
      : recipes.find((recipe) => recipe.id === recipeDetailId) ?? null;
  const countRecipe =
    countEditRecipeId === null
      ? null
      : recipes.find((recipe) => recipe.id === countEditRecipeId) ?? null;

  const recipeEntries = recipes
    .map((recipe) => ({
      recipe,
      match: evaluateRecipe(recipe, pantrySelectionSet, recipeQuery, recipeMatchMode),
    }))
    .filter((entry) => entry.match.matches);

  const filteredIngredients = ingredients.filter((ingredient) => {
    const matchesQuery =
      recipelessNormalize(ingredientsQuery).length === 0 ||
      ingredient.normalizedName.includes(recipelessNormalize(ingredientsQuery));
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
    const normalizedQuery = recipelessNormalize(ingredientPickerQuery);
    const matchesQuery =
      normalizedQuery.length === 0 || ingredient.normalizedName.includes(normalizedQuery);
    const matchesFavorite = !ingredientPickerFavoritesOnly || ingredient.isFavorite;
    return matchesQuery && matchesFavorite;
  });

  const pantryFilteredIngredients = ingredients.filter((ingredient) => {
    const normalizedQuery = recipelessNormalize(pantryQuery);
    const matchesQuery =
      normalizedQuery.length === 0 || ingredient.normalizedName.includes(normalizedQuery);
    const matchesFavorite = !pantryFavoritesOnly || ingredient.isFavorite;
    return matchesQuery && matchesFavorite;
  });

  function showToast(message: string) {
    setToastMessage(message);
  }

  function updateAppState(updater: (current: AppState) => AppState) {
    setAppState((current) => ensureSeedData(updater(current)));
  }

  function setThemeMode(themeMode: ThemeModeOption) {
    updateAppState((current) => ({
      ...current,
      themeMode,
    }));
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
    const confirmed = window.confirm(
      `Ingredience "${ingredient.name}" bude odstraněná ze seznamu.`,
    );
    if (!confirmed) {
      return;
    }

    updateAppState((current) => ({
      ...current,
      ingredients: current.ingredients.filter((item) => item.id !== ingredient.id),
      pantrySelection: current.pantrySelection.filter((item) => item !== ingredient.id),
    }));
    showToast("Ingredience byla smazaná.");
  }

  function openRecipeForm(recipe?: Recipe) {
    setRecipeForm(
      recipe
        ? {
            recipeId: recipe.id,
            title: recipe.title,
            description: recipe.description,
            imagePath: recipe.imagePath,
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

  async function updateRecipeImage(file: File | null) {
    if (!file) {
      return;
    }
    const imagePath = await fileToDataUrl(file);
    setRecipeForm((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        imagePath,
      };
    });
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

      const now = new Date().toISOString();
      const recipe: Recipe = recipeForm.recipeId
        ? {
            ...(current.recipes.find((item) => item.id === recipeForm.recipeId) as Recipe),
            title: recipeForm.title.trim(),
            normalizedTitle: normalizeText(recipeForm.title),
            description: recipeForm.description.trim(),
            imagePath: recipeForm.imagePath,
            updatedAt: now,
            ingredients: embeddedIngredients,
          }
        : {
            id: getNextId(current.recipes.map((item) => item.id)),
            title: recipeForm.title.trim(),
            normalizedTitle: normalizeText(recipeForm.title),
            description: recipeForm.description.trim(),
            imagePath: recipeForm.imagePath,
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
    const confirmed = window.confirm(`Recept "${recipe.title}" bude trvale odstraněný.`);
    if (!confirmed) {
      return;
    }
    updateAppState((current) => ({
      ...current,
      recipes: current.recipes.filter((item) => item.id !== recipe.id),
    }));
    setRecipeDetailId((current) => (current === recipe.id ? null : current));
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
              </div>
            </div>

            {recipeEntries.length === 0 ? (
              <EmptyState
                title={recipes.length === 0 ? "Zatím tu nic není" : "Nic neodpovídá filtru"}
                message={
                  recipes.length === 0
                    ? "Přidej první recept a aplikace začne fungovat naplno."
                    : "Zkus upravit hledání nebo výběr ingrediencí, které máš doma."
                }
                actionLabel="Přidat recept"
                onAction={() => openRecipeForm()}
              />
            ) : (
              <div className="content-stack">
                {recipeEntries.map(({ recipe, match }) => (
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
                ))}
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
              {recipelessNormalize(ingredientPickerQuery).length > 0
                ? `Vytvořit "${ingredientPickerQuery.trim()}"`
                : "Nová ingredience"}
            </button>

            {pickerFilteredIngredients.length === 0 ? (
              <p className="muted-copy">
                {recipelessNormalize(ingredientPickerQuery).length === 0
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

              <div className="image-tools">
                <RecipeImage path={recipeForm.imagePath} alt="Náhled fotky receptu" large />
                <label className="secondary-button file-button">
                  <ImagePlus size={16} />
                  Vybrat fotku
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void updateRecipeImage(event.target.files?.[0] ?? null)}
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
                </div>
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
                </div>
              </div>

              <RecipeImage path={selectedRecipe.imagePath} alt={selectedRecipe.title} large />
            </section>

            <section className="form-card">
              <h3>Ingredience</h3>
              <div className="ingredient-lines">
                {selectedRecipe.ingredients.map((ingredient, index) => (
                  <div key={`${ingredient.ingredientId ?? "custom"}-${index}`} className="ingredient-line">
                    <Circle size={8} />
                    <span>
                      {ingredient.ingredientNameSnapshot}
                      {ingredient.amountText.trim().length > 0
                        ? ` - ${ingredient.amountText} ${getUnitLabel(ingredient.unit)}`
                        : ""}
                    </span>
                  </div>
                ))}
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

      {toastMessage ? <div className="toast">{toastMessage}</div> : null}

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

  return (
    <div className="theme-menu">
      <button
        type="button"
        className="icon-button glass"
        aria-label={buttonLabel}
        onClick={() => setOpen((current) => !current)}
      >
        {currentMode === "dark" ? <Moon size={18} /> : currentMode === "light" ? <Sun size={18} /> : <Settings2 size={18} />}
      </button>
      {open ? (
        <div className="theme-menu-panel">
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
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={size === "wide" ? "modal-window wide" : "modal-window"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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

function recipelessNormalize(value: string): string {
  return normalizeText(value);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Nepodařilo se načíst obrázek."));
    };
    reader.onerror = () => reject(new Error("Nepodařilo se načíst obrázek."));
    reader.readAsDataURL(file);
  });
}
