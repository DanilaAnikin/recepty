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
import { ConfirmDialog, EmptyState, VirtualList } from "@/components/ui/primitives";

type IngredientRow =
  | { kind: "header"; letter: string }
  | { kind: "item"; ingredient: Ingredient };

/** Výšky řádků musí sedět s CSS, jinak by virtualizace počítala špatné posuny. */
const HEADER_ROW_HEIGHT = 38;
const ITEM_ROW_HEIGHT = 64;

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

  /**
   * Seznam se vykresluje virtualizovaně, takže skupiny musí být "plochý"
   * proud řádků — nadpis písmene je prostě další řádek, jen nižší.
   * Bez toho by se při 300+ ingrediencích překreslovalo všech ~1500 uzlů
   * při každém stisku klávesy ve vyhledávání.
   */
  const rows = useMemo(() => {
    const result: IngredientRow[] = [];
    let currentLetter: string | null = null;

    for (const ingredient of filtered) {
      if (ingredient.firstLetter !== currentLetter) {
        currentLetter = ingredient.firstLetter;
        result.push({ kind: "header", letter: currentLetter });
      }
      result.push({ kind: "item", ingredient });
    }

    return result;
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

      {rows.length === 0 ? (
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
          <VirtualList
            items={rows}
            rowHeight={(row) => (row.kind === "header" ? HEADER_ROW_HEIGHT : ITEM_ROW_HEIGHT)}
            maxHeight={640}
            renderRow={(row) =>
              row.kind === "header" ? (
                <h3 className="ingredient-letter">{row.letter}</h3>
              ) : (
                <IngredientListRow
                  ingredient={row.ingredient}
                  pantryItem={pantryByIngredient.get(row.ingredient.id)}
                  onTogglePantry={() =>
                    commit(
                      (current) => mutations.togglePantryItem(current, row.ingredient.id),
                      "Změna zásob",
                    )
                  }
                  onEditPantry={() => setPantryEditor(row.ingredient)}
                  onToggleFavorite={() =>
                    commit(
                      (current) => mutations.toggleIngredientFavorite(current, row.ingredient.id),
                      "Oblíbená ingredience",
                    )
                  }
                  onRename={() => setEditing({ ingredient: row.ingredient, name: row.ingredient.name })}
                  onDelete={() => setConfirmDelete(row.ingredient)}
                />
              )
            }
          />
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

/** Jeden řádek seznamu ingrediencí. */
function IngredientListRow({
  ingredient,
  pantryItem,
  onTogglePantry,
  onEditPantry,
  onToggleFavorite,
  onRename,
  onDelete,
}: {
  ingredient: Ingredient;
  pantryItem: PantryItem | undefined;
  onTogglePantry: () => void;
  onEditPantry: () => void;
  onToggleFavorite: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const days = daysUntilExpiry(pantryItem?.expiresAt);

  return (
    <div className="ingredient-row">
      <label className="ingredient-home-toggle">
        <input
          type="checkbox"
          checked={pantryItem !== undefined}
          onChange={onTogglePantry}
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
          <span
            className={days < 0 ? "expiry-chip past" : days <= 3 ? "expiry-chip soon" : "expiry-chip"}
          >
            <CalendarClock size={11} aria-hidden="true" />
            {expiryPhrase(days)}
          </span>
        ) : null}
      </span>

      {pantryItem ? (
        <button
          type="button"
          className="icon-button ghost"
          onClick={onEditPantry}
          aria-label={`Upravit zásobu ${ingredient.name}`}
        >
          <ShoppingBasket size={16} aria-hidden="true" />
        </button>
      ) : null}

      <button
        type="button"
        className={ingredient.isFavorite ? "icon-button favorite active" : "icon-button favorite"}
        onClick={onToggleFavorite}
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
        onClick={onRename}
        aria-label={`Přejmenovat ${ingredient.name}`}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="icon-button danger"
        onClick={onDelete}
        aria-label={`Smazat ${ingredient.name}`}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
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
