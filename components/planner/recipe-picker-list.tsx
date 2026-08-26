"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { Recipe } from "@/lib/domain";
import { buildSearchIndex, scoreRecipe } from "@/lib/search";
import { VirtualList } from "@/components/ui/primitives";

/** Hledání receptu pro plánovač — stejné skórování jako na hlavní záložce. */
export function RecipePickerList({
  recipes,
  onSelect,
}: {
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
}) {
  const [query, setQuery] = useState("");

  const indexes = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, buildSearchIndex(recipe)])),
    [recipes],
  );

  const filtered = useMemo(() => {
    if (query.trim().length === 0) {
      return recipes;
    }
    return recipes
      .map((recipe) => ({ recipe, score: scoreRecipe(indexes.get(recipe.id)!, query) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.recipe);
  }, [recipes, query, indexes]);

  return (
    <div className="content-stack compact">
      <div className="search-row">
        <Search size={18} aria-hidden="true" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat recept"
          aria-label="Vyhledat recept"
          type="search"
        />
        {query ? (
          <button
            type="button"
            className="icon-button ghost"
            onClick={() => setQuery("")}
            aria-label="Vymazat hledání"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <VirtualList
        items={filtered}
        rowHeight={56}
        maxHeight={380}
        className="selection-list"
        emptyState={<p className="muted-copy">Žádný recept neodpovídá.</p>}
        renderRow={(recipe) => (
          <button type="button" className="picker-row" onClick={() => onSelect(recipe)}>
            <span>{recipe.title}</span>
            {typeof recipe.servings === "number" ? (
              <span className="muted-copy small">{recipe.servings} porcí</span>
            ) : null}
          </button>
        )}
      />
    </div>
  );
}
