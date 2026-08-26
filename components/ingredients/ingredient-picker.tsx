"use client";

import { Heart, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { normalizeText, type Ingredient } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { useAppState } from "@/components/app/app-state";
import { VirtualList } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

/**
 * Výběr ingredience ze seznamu.
 *
 * Seznam má přes 300 položek, takže se vykresluje virtualizovaně — jinak by
 * každý stisk klávesy ve vyhledávání překreslil všechny řádky.
 */
export function IngredientPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (ingredient: Ingredient) => void;
}) {
  const { state, commit } = useAppState();
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return state.ingredients.filter((ingredient) => {
      const matchesQuery =
        normalizedQuery.length === 0 || ingredient.normalizedName.includes(normalizedQuery);
      return matchesQuery && (!favoritesOnly || ingredient.isFavorite);
    });
  }, [state.ingredients, query, favoritesOnly]);

  const trimmedQuery = query.trim();
  const exactExists = state.ingredients.some(
    (ingredient) => ingredient.normalizedName === normalizeText(trimmedQuery),
  );

  const handleCreate = () => {
    if (trimmedQuery.length === 0) {
      return;
    }
    let created: Ingredient | null = null;
    commit((current) => {
      const result = mutations.addIngredient(current, trimmedQuery);
      created = result.ingredient;
      return result.state;
    }, "Nová ingredience");

    if (created) {
      onSelect(created);
    }
  };

  return (
    <Modal
      title="Vyber ingredienci"
      onClose={onClose}
      footer={
        <button type="button" className="secondary-button" onClick={onClose}>
          Zavřít
        </button>
      }
    >
      <div className="content-stack compact">
        <div className="search-row">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat ingredienci"
            aria-label="Vyhledat ingredienci"
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

        <div className="pill-row">
          <button
            type="button"
            className={!favoritesOnly ? "pill-button active" : "pill-button"}
            onClick={() => setFavoritesOnly(false)}
          >
            Vše
          </button>
          <button
            type="button"
            className={favoritesOnly ? "pill-button active" : "pill-button"}
            onClick={() => setFavoritesOnly(true)}
          >
            Oblíbené
          </button>
        </div>

        {trimmedQuery.length > 0 && !exactExists ? (
          <button type="button" className="secondary-button align-start" onClick={handleCreate}>
            <Plus size={16} aria-hidden="true" />
            {`Vytvořit „${trimmedQuery}"`}
          </button>
        ) : null}

        <VirtualList
          items={filtered}
          rowHeight={56}
          maxHeight={380}
          className="selection-list"
          emptyState={
            <p className="muted-copy">
              {trimmedQuery.length === 0
                ? "Zatím tu nejsou žádné ingredience."
                : "Nic nenalezeno. Ingredienci můžeš rovnou vytvořit."}
            </p>
          }
          renderRow={(ingredient) => (
            <button type="button" className="picker-row" onClick={() => onSelect(ingredient)}>
              <span>{ingredient.name}</span>
              {ingredient.isFavorite ? <Heart size={14} aria-hidden="true" /> : null}
            </button>
          )}
        />
      </div>
    </Modal>
  );
}
