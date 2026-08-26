"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  Heart,
  HeartOff,
  Pencil,
  Plus,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  INGREDIENT_UNITS,
  daysUntilExpiry,
  expiringPantryItems,
  normalizeText,
  type Ingredient,
  type IngredientUnit,
  type PantryItem,
} from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, EmptyState } from "@/components/ui/primitives";

export function IngredientsTab() {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites" | "pantry">("all");
  const [editing, setEditing] = useState<{ ingredient: Ingredient | null; name: string } | null>(null);
  const [pantryEditor, setPantryEditor] = useState<Ingredient | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Ingredient | null>(null);

  const pantryByIngredient = useMemo(
    () => new Map(state.pantry.map((item) => [item.ingredientId, item])),
    [state.pantry],
  );

  const expiring = useMemo(() => expiringPantryItems(state.pantry, 3), [state.pantry]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return state.ingredients.filter((ingredient) => {
      if (normalizedQuery.length > 0 && !ingredient.normalizedName.includes(normalizedQuery)) {
        return false;
      }
      if (filter === "favorites") {
        return ingredient.isFavorite;
      }
      if (filter === "pantry") {
        return pantryByIngredient.has(ingredient.id);
      }
      return true;
    });
  }, [state.ingredients, query, filter, pantryByIngredient]);

  const grouped = useMemo(() => {
    const groups: Array<{ letter: string; items: Ingredient[] }> = [];
    for (const ingredient of filtered) {
      const last = groups.at(-1);
      if (!last || last.letter !== ingredient.firstLetter) {
        groups.push({ letter: ingredient.firstLetter, items: [ingredient] });
      } else {
        last.items.push(ingredient);
      }
    }
    return groups;
  }, [filtered]);

  const handleSaveName = () => {
    if (!editing) {
      return;
    }
    const name = editing.name.trim();
    if (name.length === 0) {
      showToast("Název nesmí být prázdný.", { tone: "danger" });
      return;
    }

    const duplicate = state.ingredients.find(
      (item) => item.normalizedName === normalizeText(name) && item.id !== editing.ingredient?.id,
    );
    if (duplicate) {
      showToast(`„${duplicate.name}" už v seznamu je.`, { tone: "danger" });
      return;
    }

    if (editing.ingredient) {
      const id = editing.ingredient.id;
      commit((current) => mutations.renameIngredient(current, id, name), "Přejmenování ingredience");
    } else {
      commit((current) => mutations.addIngredient(current, name).state, "Nová ingredience");
    }
    setEditing(null);
  };

  const handleDelete = (ingredient: Ingredient) => {
    const snapshot = state;
    commit((current) => mutations.deleteIngredient(current, ingredient.id), "Smazání ingredience");
    setConfirmDelete(null);
    showToast(`„${ingredient.name}" smazáno.`, {
      action: {
        label: "Zpět",
        onClick: () => commit(() => snapshot, "Obnovení ingredience"),
      },
    });
  };

  const pantryCount = state.pantry.length;

  return (
    <section className="content-stack">
      <div className="section-intro">
        <div>
          <p className="section-eyebrow">Ingredience a zásoby</p>
          <h2>Co máš doma?</h2>
          <p>
            Označ, co máš ve spíži. U každé položky si můžeš zapsat množství
            i datum spotřeby, aby ti nic netiše neprošlo.
          </p>
        </div>

        <button
          type="button"
          className="primary-button desktop-action"
          onClick={() => setEditing({ ingredient: null, name: "" })}
        >
          <Plus size={16} aria-hidden="true" />
          Nová ingredience
        </button>
      </div>

      {expiring.length > 0 ? (
        <div className="panel-card expiry-warning" role="status">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>Hlídej si spotřebu</strong>
            <ul>
              {expiring.slice(0, 5).map(({ item, days }) => {
                const ingredient = state.ingredients.find(
                  (candidate) => candidate.id === item.ingredientId,
                );
                if (!ingredient) {
                  return null;
                }
                return (
                  <li key={item.ingredientId}>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setPantryEditor(ingredient)}
                    >
                      {ingredient.name}
                    </button>{" "}
                    — {expiryPhrase(days)}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="panel-card toolbar-panel">
        <div className="search-row">
          <Search size={18} aria-hidden="true" />
          <input
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
            className={filter === "all" ? "pill-button active" : "pill-button"}
            onClick={() => setFilter("all")}
          >
            Vše
          </button>
          <button
            type="button"
            className={filter === "favorites" ? "pill-button active" : "pill-button"}
            onClick={() => setFilter("favorites")}
          >
            <Heart size={13} aria-hidden="true" />
            Oblíbené
          </button>
          <button
            type="button"
            className={filter === "pantry" ? "pill-button active" : "pill-button"}
            onClick={() => setFilter("pantry")}
          >
            <ShoppingBasket size={13} aria-hidden="true" />
            Mám doma ({pantryCount})
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="Nic nenalezeno"
          message={
            filter === "pantry"
              ? "Ve spíži zatím nic není. Zaškrtni u ingredience políčko a přidá se sem."
              : "Zkus jiné hledání, nebo si ingredienci rovnou přidej."
          }
          actionLabel="Nová ingredience"
          onAction={() => setEditing({ ingredient: null, name: query.trim() })}
        />
      ) : (
        <div className="panel-card ingredient-list-card">
          {grouped.map((group) => (
            <div key={group.letter} className="ingredient-group">
              <h3>{group.letter}</h3>
              <div className="ingredient-group-list">
                {group.items.map((ingredient) => {
                  const pantryItem = pantryByIngredient.get(ingredient.id);
                  const days = daysUntilExpiry(pantryItem?.expiresAt);

                  return (
                    <div key={ingredient.id} className="ingredient-row">
                      <label className="ingredient-home-toggle">
                        <input
                          type="checkbox"
                          checked={pantryItem !== undefined}
                          onChange={() =>
                            commit(
                              (current) => mutations.togglePantryItem(current, ingredient.id),
                              "Změna zásob",
                            )
                          }
                          aria-label={`${ingredient.name} — mám doma`}
                        />
                      </label>

                      <span className="ingredient-name">
                        {ingredient.name}
                        {pantryItem?.quantity ? (
                          <span className="ingredient-qty">
                            {pantryItem.quantity}
                            {pantryItem.unit ? ` ${unitLabelOf(pantryItem.unit)}` : ""}
                          </span>
                        ) : null}
                        {days !== null ? (
                          <span className={days < 0 ? "expiry-chip past" : days <= 3 ? "expiry-chip soon" : "expiry-chip"}>
                            <CalendarClock size={11} aria-hidden="true" />
                            {expiryPhrase(days)}
                          </span>
                        ) : null}
                      </span>

                      {pantryItem ? (
                        <button
                          type="button"
                          className="icon-button ghost"
                          onClick={() => setPantryEditor(ingredient)}
                          aria-label={`Upravit zásobu ${ingredient.name}`}
                        >
                          <ShoppingBasket size={16} aria-hidden="true" />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={ingredient.isFavorite ? "icon-button favorite active" : "icon-button favorite"}
                        onClick={() =>
                          commit(
                            (current) => mutations.toggleIngredientFavorite(current, ingredient.id),
                            "Oblíbená ingredience",
                          )
                        }
                        aria-label={ingredient.isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
                        aria-pressed={ingredient.isFavorite}
                      >
                        {ingredient.isFavorite ? (
                          <Heart size={16} aria-hidden="true" />
                        ) : (
                          <HeartOff size={16} aria-hidden="true" />
                        )}
                      </button>

                      <button
                        type="button"
                        className="icon-button ghost"
                        onClick={() => setEditing({ ingredient, name: ingredient.name })}
                        aria-label={`Přejmenovat ${ingredient.name}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => setConfirmDelete(ingredient)}
                        aria-label={`Smazat ${ingredient.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="fab"
        onClick={() => setEditing({ ingredient: null, name: "" })}
      >
        <Plus size={20} aria-hidden="true" />
        Nová ingredience
      </button>

      {editing ? (
        <Modal
          title={editing.ingredient ? "Upravit ingredienci" : "Nová ingredience"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="secondary-button" onClick={() => setEditing(null)}>
                Zrušit
              </button>
              <button type="button" className="primary-button" onClick={handleSaveName}>
                Uložit
              </button>
            </>
          }
        >
          <label className="field-stack">
            <span>Název ingredience</span>
            <input
              autoFocus
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSaveName();
                }
              }}
            />
          </label>
        </Modal>
      ) : null}

      {pantryEditor ? (
        <PantryItemDialog
          ingredient={pantryEditor}
          item={pantryByIngredient.get(pantryEditor.id)}
          onClose={() => setPantryEditor(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Smazat ingredienci?"
          message={deleteMessage(
            confirmDelete.name,
            mutations.countRecipesUsingIngredient(state, confirmDelete.id),
          )}
          confirmLabel="Smazat"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
        />
      ) : null}
    </section>
  );
}

/** Detail jedné položky spíže — množství a datum spotřeby. */
function PantryItemDialog({
  ingredient,
  item,
  onClose,
}: {
  ingredient: Ingredient;
  item: PantryItem | undefined;
  onClose: () => void;
}) {
  const { commit } = useAppState();
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [unit, setUnit] = useState<IngredientUnit | "">(item?.unit ?? "");
  const [expiresAt, setExpiresAt] = useState(item?.expiresAt ?? "");

  const handleSave = () => {
    commit(
      (current) =>
        mutations.setPantryItem(current, {
          ingredientId: ingredient.id,
          quantity: quantity.trim().length > 0 ? quantity.trim() : undefined,
          unit: unit === "" ? undefined : unit,
          expiresAt: expiresAt.length > 0 ? expiresAt : undefined,
          updatedAt: new Date().toISOString(),
        }),
      "Úprava zásoby",
    );
    onClose();
  };

  return (
    <Modal
      title={ingredient.name}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="secondary-button danger-text"
            onClick={() => {
              commit(
                (current) => mutations.removePantryItem(current, ingredient.id),
                "Odebrání ze zásob",
              );
              onClose();
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Už nemám
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            <Check size={16} aria-hidden="true" />
            Uložit
          </button>
        </>
      }
    >
      <div className="content-stack compact">
        <div className="inline-fields">
          <label className="field-stack">
            <span>Kolik mám</span>
            <input
              value={quantity}
              placeholder="500"
              inputMode="decimal"
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className="field-stack">
            <span>Jednotka</span>
            <select value={unit} onChange={(event) => setUnit(event.target.value as IngredientUnit | "")}>
              <option value="">—</option>
              {INGREDIENT_UNITS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-stack">
          <span>Spotřebovat do</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
          <span className="field-hint">
            Nepovinné. Když datum vyplníš, tři dny předem se ti to připomene.
          </span>
        </label>
      </div>
    </Modal>
  );
}

function unitLabelOf(unit: IngredientUnit): string {
  return INGREDIENT_UNITS.find((item) => item.value === unit)?.label ?? unit;
}

export function expiryPhrase(days: number): string {
  if (days < -1) {
    return `prošlo před ${Math.abs(days)} dny`;
  }
  if (days === -1) {
    return "prošlo včera";
  }
  if (days === 0) {
    return "dnes končí";
  }
  if (days === 1) {
    return "zítra končí";
  }
  return `zbývají ${days} dny`;
}

function deleteMessage(name: string, usageCount: number): string {
  if (usageCount === 0) {
    return `Opravdu smazat „${name}"? Půjde to vzít zpět.`;
  }
  return `„${name}" se používá v ${usageCount} ${
    usageCount === 1 ? "receptu" : usageCount <= 4 ? "receptech" : "receptech"
  }. V receptech řádek zůstane, jen ztratí vazbu na seznam. Půjde to vzít zpět.`;
}
