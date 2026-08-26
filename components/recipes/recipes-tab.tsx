"use client";

import {
  Clock,
  Copy,
  Heart,
  HeartOff,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  RECIPE_MATCH_MODES,
  RECIPE_SORT_MODES,
  averageRating,
  normalizeText,
  pantryIdSet,
  type Recipe,
} from "@/lib/domain";
import {
  collectTags,
  createDefaultFilters,
  filterAndSortRecipes,
  hasActiveFilters,
  totalTimeMinutes,
  type RecipeFilters,
} from "@/lib/filters";
import * as mutations from "@/lib/mutations";
import { buildSearchIndex } from "@/lib/search";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { EmptyState, RecipeImage, StarRating } from "@/components/ui/primitives";

/** Nabídka časových limitů — kulatá čísla, která se dají mačkat jedním prstem. */
const TIME_PRESETS = [
  { value: 15, label: "do 15 min" },
  { value: 30, label: "do 30 min" },
  { value: 60, label: "do 1 h" },
];

const MISSING_PRESETS = [
  { value: 0, label: "Mám všechno" },
  { value: 1, label: "Chybí 1" },
  { value: 2, label: "Chybí 2" },
];

export function RecipesTab({
  onOpenRecipe,
  onCreateRecipe,
  onImportRecipe,
}: {
  onOpenRecipe: (recipeId: number) => void;
  onCreateRecipe: () => void;
  onImportRecipe: () => void;
}) {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const [filters, setFilters] = useState<RecipeFilters>(() => ({
    ...createDefaultFilters(),
    matchMode: "full",
  }));
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const pantryIds = useMemo(() => pantryIdSet(state.pantry), [state.pantry]);

  // Normalizace všech receptů je nejdražší část hledání — počítá se jednou
  // na změnu seznamu, ne při každém stisku klávesy ve vyhledávacím poli.
  const searchIndexes = useMemo(() => {
    return new Map(state.recipes.map((recipe) => [recipe.id, buildSearchIndex(recipe)]));
  }, [state.recipes]);

  const availableTags = useMemo(() => collectTags(state.recipes), [state.recipes]);

  const entries = useMemo(
    () => filterAndSortRecipes(state.recipes, pantryIds, filters, state.recipeSortMode, searchIndexes),
    [state.recipes, pantryIds, filters, state.recipeSortMode, searchIndexes],
  );

  const updateFilters = (patch: Partial<RecipeFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const toggleTag = (normalized: string) => {
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(normalized)
        ? current.tags.filter((tag) => tag !== normalized)
        : [...current.tags, normalized],
    }));
  };

  const handleDuplicate = (recipe: Recipe) => {
    commit((current) => mutations.duplicateRecipe(current, recipe.id), "Duplikace receptu");
    showToast(`Recept „${recipe.title}" byl zkopírován.`);
  };

  const activeFilterCount =
    filters.tags.length +
    (filters.maxTotalTime !== null ? 1 : 0) +
    (filters.maxMissing !== null ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0);

  return (
    <section className="content-stack">
      <div className="section-intro">
        <div>
          <p className="section-eyebrow">Recepty</p>
          <h2>Co budeš vařit?</h2>
          <p>
            Filtruj podle toho, co máš doma, kolik máš času, nebo si nech ukázat
            recepty, kde ti chybí jediná ingredience.
          </p>
        </div>

        <div className="section-intro-actions desktop-action">
          <button type="button" className="secondary-button" onClick={onImportRecipe}>
            <Link2 size={16} aria-hidden="true" />
            Importovat
          </button>
          <button type="button" className="primary-button" onClick={onCreateRecipe}>
            <Plus size={16} aria-hidden="true" />
            Nový recept
          </button>
        </div>
      </div>

      <div className="panel-card toolbar-panel">
        <div className="search-row">
          <Search size={18} aria-hidden="true" />
          <input
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            placeholder="Hledat v názvech, ingrediencích i postupu"
            aria-label="Vyhledat recept"
            type="search"
          />
          {filters.query ? (
            <button
              type="button"
              className="icon-button ghost"
              onClick={() => updateFilters({ query: "" })}
              aria-label="Vymazat hledání"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="toolbar-wrap">
          <button
            type="button"
            className={filtersExpanded ? "secondary-button active-outline" : "secondary-button"}
            onClick={() => setFiltersExpanded((current) => !current)}
            aria-expanded={filtersExpanded}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filtry
            {activeFilterCount > 0 ? <span className="filter-badge">{activeFilterCount}</span> : null}
          </button>

          <div className="segmented-control" role="group" aria-label="Režim párování se zásobami">
            {RECIPE_MATCH_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={filters.matchMode === mode.value ? "segment-button active" : "segment-button"}
                onClick={() => updateFilters({ matchMode: mode.value })}
                aria-pressed={filters.matchMode === mode.value}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <label className="recipe-sort-select">
            <span className="recipe-sort-label">Řadit</span>
            <select
              value={state.recipeSortMode}
              onChange={(event) =>
                commit(
                  (current) =>
                    mutations.setRecipeSortMode(
                      current,
                      event.target.value as typeof current.recipeSortMode,
                    ),
                  "Změna řazení",
                  { track: false },
                )
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

          <button
            type="button"
            className={filters.favoritesOnly ? "pill-button active" : "pill-button"}
            onClick={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
            aria-pressed={filters.favoritesOnly}
          >
            <Heart size={14} aria-hidden="true" />
            Oblíbené
          </button>

          {/* Import je i tady, ne jen v hlavičce sekce — ta se na mobilu skrývá
              a bez tohohle by na telefonu nešel recept naimportovat vůbec. */}
          <button type="button" className="secondary-button mobile-only-action" onClick={onImportRecipe}>
            <Link2 size={16} aria-hidden="true" />
            Importovat
          </button>
        </div>

        {filtersExpanded ? (
          <div className="filter-drawer">
            <div className="filter-group">
              <span className="filter-group-label">Kolik mám času</span>
              <div className="pill-row">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={filters.maxTotalTime === preset.value ? "pill-button active" : "pill-button"}
                    onClick={() =>
                      updateFilters({
                        maxTotalTime: filters.maxTotalTime === preset.value ? null : preset.value,
                      })
                    }
                    aria-pressed={filters.maxTotalTime === preset.value}
                  >
                    <Clock size={13} aria-hidden="true" />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group-label">Co mi chybí ze zásob</span>
              <div className="pill-row">
                {MISSING_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={filters.maxMissing === preset.value ? "pill-button active" : "pill-button"}
                    onClick={() =>
                      updateFilters({
                        maxMissing: filters.maxMissing === preset.value ? null : preset.value,
                      })
                    }
                    aria-pressed={filters.maxMissing === preset.value}
                    disabled={pantryIds.size === 0}
                    title={pantryIds.size === 0 ? "Nejdřív si vyber, co máš doma." : undefined}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {pantryIds.size === 0 ? (
                <p className="muted-copy small">
                  Tenhle filtr začne fungovat, až si na záložce Ingredience označíš,
                  co máš doma.
                </p>
              ) : null}
            </div>

            {availableTags.length > 0 ? (
              <div className="filter-group">
                <span className="filter-group-label">Štítky</span>
                <div className="pill-row">
                  {availableTags.slice(0, 18).map((tag) => (
                    <button
                      key={tag.normalized}
                      type="button"
                      className={
                        filters.tags.includes(tag.normalized) ? "pill-button active" : "pill-button"
                      }
                      onClick={() => toggleTag(tag.normalized)}
                      aria-pressed={filters.tags.includes(tag.normalized)}
                    >
                      <Tag size={13} aria-hidden="true" />
                      {tag.tag}
                      <span className="pill-count">{tag.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {hasActiveFilters(filters) ? (
              <button
                type="button"
                className="ghost-button align-start"
                onClick={() => setFilters({ ...createDefaultFilters(), matchMode: filters.matchMode })}
              >
                <X size={15} aria-hidden="true" />
                Zrušit všechny filtry
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="result-count" aria-live="polite">
          {entries.length === state.recipes.length
            ? `${state.recipes.length} ${pluralRecipes(state.recipes.length)}`
            : `${entries.length} z ${state.recipes.length} ${pluralRecipes(state.recipes.length)}`}
        </p>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title={state.recipes.length === 0 ? "Zatím tu nic není" : "Nic neodpovídá filtru"}
          message={
            state.recipes.length === 0
              ? "Přidej první recept, nebo si nějaký naimportuj z webu."
              : "Zkus upravit hledání, povolit víc chybějících ingrediencí, nebo filtry zrušit."
          }
          actionLabel={state.recipes.length === 0 ? "Přidat recept" : undefined}
          onAction={state.recipes.length === 0 ? onCreateRecipe : undefined}
        />
      ) : (
        <div className="content-stack recipe-list">
          {entries.map(({ recipe, match }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              missingIngredients={match.missingIngredients}
              onOpen={() => onOpenRecipe(recipe.id)}
              onToggleFavorite={() =>
                commit(
                  (current) => mutations.toggleRecipeFavorite(current, recipe.id),
                  recipe.isFavorite ? "Odebrání z oblíbených" : "Přidání do oblíbených",
                )
              }
              onDuplicate={() => handleDuplicate(recipe)}
            />
          ))}
        </div>
      )}

      <button type="button" className="fab" onClick={onCreateRecipe}>
        <Plus size={20} aria-hidden="true" />
        Nový recept
      </button>
    </section>
  );
}

function RecipeCard({
  recipe,
  missingIngredients,
  onOpen,
  onToggleFavorite,
  onDuplicate,
}: {
  recipe: Recipe;
  missingIngredients: string[];
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
}) {
  const time = totalTimeMinutes(recipe);
  const rating = averageRating(recipe);
  const hasServings = typeof recipe.servings === "number" && recipe.servings > 0;

  return (
    <article className="recipe-card">
      <button type="button" className="recipe-card-main" onClick={onOpen}>
        <RecipeImage
          source={recipe.imageKeys?.[0] ?? recipe.imageUrls?.[0] ?? recipe.imagePath}
          alt={recipe.title}
        />

        <div className="recipe-card-copy">
          <h3>{recipe.title}</h3>
          <p>
            {recipe.ingredients.length} {pluralIngredients(recipe.ingredients.length)}
          </p>

          {time !== null || hasServings || rating !== null ? (
            <div className="recipe-meta-row">
              {time !== null ? (
                <span className="recipe-meta-item">
                  <Clock size={14} aria-hidden="true" />
                  {formatMinutes(time)}
                </span>
              ) : null}
              {hasServings ? (
                <span className="recipe-meta-item">
                  <Users size={14} aria-hidden="true" />
                  {recipe.servings} porcí
                </span>
              ) : null}
              {rating !== null ? <StarRating value={rating} size={14} /> : null}
            </div>
          ) : null}

          {recipe.tags && recipe.tags.length > 0 ? (
            <div className="tag-chip-row">
              {recipe.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {missingIngredients.length > 0 ? (
            <p className="missing-copy">
              {missingIngredients.length === 1
                ? `Chybí: ${missingIngredients[0]}`
                : `Chybí ${missingIngredients.length}: ${missingIngredients.slice(0, 3).join(", ")}${
                    missingIngredients.length > 3 ? "…" : ""
                  }`}
            </p>
          ) : null}
        </div>
      </button>

      <div className="card-actions">
        <button
          type="button"
          className={recipe.isFavorite ? "icon-button favorite active" : "icon-button favorite"}
          onClick={onToggleFavorite}
          aria-label={recipe.isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
          aria-pressed={recipe.isFavorite === true}
        >
          {recipe.isFavorite ? <Heart size={16} aria-hidden="true" /> : <HeartOff size={16} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="icon-button ghost"
          onClick={onDuplicate}
          aria-label={`Duplikovat recept ${recipe.title}`}
        >
          <Copy size={16} aria-hidden="true" />
        </button>
        <span className="counter-pill" title="Kolikrát jsi tohle vařila">
          {recipe.cookingCount}×
        </span>
      </div>
    </article>
  );
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function pluralRecipes(count: number): string {
  if (count === 1) return "recept";
  if (count >= 2 && count <= 4) return "recepty";
  return "receptů";
}

function pluralIngredients(count: number): string {
  if (count === 1) return "ingredience";
  if (count >= 2 && count <= 4) return "ingredience";
  return "ingrediencí";
}

/** Pomocník pro filtry ve vyšších vrstvách — sjednocuje normalizaci štítků. */
export function normalizeTagList(tags: string[]): string[] {
  return tags.map(normalizeText).filter((tag) => tag.length > 0);
}
