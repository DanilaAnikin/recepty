"use client";

import {
  CalendarRange,
  Check,
  Plus,
  Share2,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { pantryIdSet } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { plannedRecipesInRange, startOfWeek, toDateKey, addDays } from "@/lib/planner";
import { buildShoppingItems, formatShoppingAmount, shoppingListToText } from "@/lib/shopping";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { ConfirmDialog, EmptyState } from "@/components/ui/primitives";

/**
 * Nákupní seznam.
 *
 * Položky sem chodí ze tří míst: z detailu receptu, z týdenního plánu a ručně.
 * Stejné ingredience se slučují a množství sčítá, takže se ve dvou receptech
 * použitá mouka objeví jednou s celkovým množstvím.
 */
export function ShoppingTab({ onOpenPlanner }: { onOpenPlanner: () => void }) {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const [manualName, setManualName] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const pantryIds = useMemo(() => pantryIdSet(state.pantry), [state.pantry]);

  const pending = state.shoppingList.filter((item) => !item.checked);
  const done = state.shoppingList.filter((item) => item.checked);

  const handleAddManual = () => {
    const name = manualName.trim();
    if (name.length === 0) {
      return;
    }
    commit((current) => mutations.addManualShoppingItem(current, name), "Přidání do nákupu");
    setManualName("");
  };

  const handleAddFromPlan = () => {
    const weekStart = startOfWeek(new Date());
    const fromKey = toDateKey(weekStart);
    const toKey = toDateKey(addDays(weekStart, 6));

    const planned = plannedRecipesInRange(state.mealPlan, state.recipes, fromKey, toKey);
    if (planned.length === 0) {
      showToast("Na tenhle týden zatím nic naplánovaného není.");
      return;
    }

    const items = buildShoppingItems(planned, { pantryIds, skipPantry: true, source: "plan" });
    if (items.length === 0) {
      showToast("Na celý naplánovaný týden máš všechno doma.");
      return;
    }

    commit((current) => mutations.addShoppingItems(current, items), "Nákup z plánu");
    showToast(`Přidáno ${items.length} položek z plánu na tento týden.`);
  };

  const handleShare = async () => {
    const text = shoppingListToText(state.shoppingList);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Nákupní seznam", text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Seznam zkopírován do schránky.");
    } catch {
      showToast("Sdílení se nepodařilo.", { tone: "danger" });
    }
  };

  const handleMoveToPantry = () => {
    if (done.length === 0) {
      showToast("Nejdřív si něco odškrtni.");
      return;
    }
    const movable = done.filter((item) => item.ingredientId !== null).length;
    commit((current) => mutations.moveCheckedToPantry(current), "Nákup do spíže");
    showToast(
      movable > 0
        ? `Do spíže přesunuto ${movable} ${movable === 1 ? "položka" : "položek"}.`
        : "Odškrtnuté položky odstraněny.",
    );
  };

  return (
    <section className="content-stack">
      <div className="section-intro">
        <div>
          <p className="section-eyebrow">Nákup</p>
          <h2>Co koupit</h2>
          <p>
            Položky z receptů a z plánu se tu slučují dohromady. To, co už máš
            doma, se automaticky vynechává.
          </p>
        </div>
      </div>

      <div className="panel-card toolbar-panel">
        <div className="search-row">
          <Plus size={18} aria-hidden="true" />
          <input
            value={manualName}
            onChange={(event) => setManualName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleAddManual();
              }
            }}
            placeholder="Přidat vlastní položku"
            aria-label="Přidat položku do nákupního seznamu"
          />
          {manualName.trim().length > 0 ? (
            <button type="button" className="secondary-button" onClick={handleAddManual}>
              Přidat
            </button>
          ) : null}
        </div>

        {/* Na mobilu se z téhle řádky stává vodorovný pruh akčních chipů:
            v obchodě má být vidět seznam, ne tři řádky tlačítek. */}
        <div className="toolbar-wrap action-scroller">
          <button type="button" className="secondary-button" onClick={handleAddFromPlan}>
            <CalendarRange size={16} aria-hidden="true" />
            Z plánu na tento týden
          </button>
          <button type="button" className="secondary-button" onClick={onOpenPlanner}>
            Otevřít plánovač
          </button>
          {state.shoppingList.length > 0 ? (
            <>
              <button type="button" className="secondary-button" onClick={() => void handleShare()}>
                <Share2 size={16} aria-hidden="true" />
                Sdílet
              </button>
              <button type="button" className="secondary-button" onClick={handleMoveToPantry}>
                <ShoppingBasket size={16} aria-hidden="true" />
                Odškrtnuté do spíže
              </button>
              <button
                type="button"
                className="secondary-button danger-text"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Vyprázdnit
              </button>
            </>
          ) : null}
        </div>

        {state.shoppingList.length > 0 ? (
          <p className="result-count" aria-live="polite">
            {pending.length === 0
              ? "Všechno nakoupeno."
              : `Zbývá ${pending.length} z ${state.shoppingList.length}`}
          </p>
        ) : null}
      </div>

      {state.shoppingList.length === 0 ? (
        <EmptyState
          title="Nákupní seznam je prázdný"
          message={'Otevři recept a klepni na „Do nákupu", nebo si nech seznam vygenerovat z týdenního plánu.'}
        />
      ) : (
        <div className="panel-card shopping-card">
          {done.length > 0 ? (
            <div className="section-header">
              <h3>
                Zbývá {pending.length}, v košíku {done.length}
              </h3>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  commit(
                    (current) => mutations.clearCheckedShoppingItems(current),
                    "Úklid odškrtnutých",
                  )
                }
              >
                <Check size={15} aria-hidden="true" />
                Odstranit odškrtnuté
              </button>
            </div>
          ) : null}

          {/* Jeden seznam, ne dva.
              Kdyby odškrtnutá položka přeskakovala do samostatného seznamu,
              zanikl by původní prvek v DOM a jeho checkbox by se nikdy
              nestal zaškrtnutým — pro čtečku obrazovky (a pro automatizaci)
              by to vypadalo jako nefunkční ovládací prvek. Takhle zůstává
              stejný prvek a jen se přeřadí dolů. */}
          <ul className="shopping-list">
            {state.shoppingList.map((item) => (
              <li key={item.id}>
                <label className={item.checked ? "shopping-row checked" : "shopping-row"}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() =>
                      commit(
                        (current) => mutations.toggleShoppingItem(current, item.id),
                        item.checked ? "Vrácení položky" : "Odškrtnutí položky",
                        { track: false },
                      )
                    }
                    aria-label={`Koupeno: ${item.name}`}
                  />
                  <span className="shopping-body">
                    <span className="shopping-name">{item.name}</span>
                    {formatShoppingAmount(item) ? (
                      <span className="shopping-amount">{formatShoppingAmount(item)}</span>
                    ) : null}
                    {!item.checked && item.recipeTitles && item.recipeTitles.length > 0 ? (
                      <span className="shopping-origin">{item.recipeTitles.join(" · ")}</span>
                    ) : null}
                  </span>
                </label>
                <button
                  type="button"
                  className="icon-button ghost danger"
                  onClick={() =>
                    commit(
                      (current) => mutations.removeShoppingItem(current, item.id),
                      "Odebrání položky",
                    )
                  }
                  aria-label={`Odebrat ${item.name}`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmClear ? (
        <ConfirmDialog
          title="Vyprázdnit nákupní seznam?"
          message="Smaže se úplně všechno, i to, co ještě není odškrtnuté. Půjde to vzít zpět."
          confirmLabel="Vyprázdnit"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            commit((current) => mutations.clearShoppingList(current), "Vyprázdnění nákupu");
            setConfirmClear(false);
          }}
        />
      ) : null}
    </section>
  );
}
