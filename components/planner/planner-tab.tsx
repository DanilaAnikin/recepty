"use client";

import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MEAL_SLOTS, pantryIdSet, type MealSlot, type Recipe } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import {
  addDays,
  buildWeek,
  countPlannedMeals,
  plannedRecipesInRange,
  shortDateLabel,
  slotLabel,
  startOfWeek,
  toDateKey,
  weekdayLabel,
} from "@/lib/planner";
import { buildShoppingItems } from "@/lib/shopping";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/primitives";
import { RecipePickerList } from "./recipe-picker-list";

/**
 * Týdenní plánovač jídel.
 *
 * Na mobilu se plánuje klepnutím (drag & drop se na dotykovém displeji dělá
 * mizerně), na desktopu jde recept do dne přetáhnout.
 */
export function PlannerTab({ onOpenRecipe }: { onOpenRecipe: (recipeId: number) => void }) {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [picker, setPicker] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const pantryIds = useMemo(() => pantryIdSet(state.pantry), [state.pantry]);
  const recipesById = useMemo(
    () => new Map(state.recipes.map((recipe) => [recipe.id, recipe])),
    [state.recipes],
  );

  const week = useMemo(() => buildWeek(weekStart, state.mealPlan), [weekStart, state.mealPlan]);
  const plannedCount = countPlannedMeals(week);

  const fromKey = toDateKey(weekStart);
  const toKey = toDateKey(addDays(weekStart, 6));

  const handleGenerateShoppingList = () => {
    const planned = plannedRecipesInRange(state.mealPlan, state.recipes, fromKey, toKey);
    if (planned.length === 0) {
      showToast("V tomhle týdnu není co nakupovat.");
      return;
    }

    const items = buildShoppingItems(planned, { pantryIds, skipPantry: true, source: "plan" });
    if (items.length === 0) {
      showToast("Na celý týden máš všechno doma.");
      return;
    }

    commit((current) => mutations.addShoppingItems(current, items), "Nákup z plánu");
    showToast(`Do nákupu přidáno ${items.length} položek.`);
  };

  const addToSlot = (date: string, slot: MealSlot, recipe: Recipe) => {
    commit(
      (current) =>
        mutations.addMealPlanEntry(current, {
          date,
          slot,
          recipeId: recipe.id,
          servings: recipe.servings,
        }),
      "Naplánování jídla",
    );
    setPicker(null);
  };

  return (
    <section className="content-stack">
      <div className="section-intro">
        <div>
          <p className="section-eyebrow">Plán</p>
          <h2>Týdenní menu</h2>
          <p>
            Naplánuj si týden dopředu a nech si z celého plánu vygenerovat jeden
            nákupní seznam.
          </p>
        </div>
      </div>

      <div className="panel-card toolbar-panel">
        <div className="week-nav">
          <button
            type="button"
            className="icon-button ghost"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Předchozí týden"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>

          <div className="week-nav-label">
            <strong>
              {shortDateLabel(fromKey)} – {shortDateLabel(toKey)}
            </strong>
            <span className="muted-copy small">
              {plannedCount === 0 ? "zatím prázdný týden" : `${plannedCount} naplánovaných jídel`}
            </span>
          </div>

          <button
            type="button"
            className="icon-button ghost"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Následující týden"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="toolbar-wrap">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
          >
            Tento týden
          </button>
          <button type="button" className="primary-button" onClick={handleGenerateShoppingList}>
            <ShoppingCart size={16} aria-hidden="true" />
            Nákup z celého týdne
          </button>
          {plannedCount > 0 ? (
            <button
              type="button"
              className="secondary-button danger-text"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Vyprázdnit týden
            </button>
          ) : null}
        </div>
      </div>

      <div className="planner-grid">
        {week.map((day) => (
          <div
            key={day.date}
            className={day.isToday ? "planner-day today" : "planner-day"}
          >
            <header className="planner-day-header">
              <strong>{weekdayLabel(day.date)}</strong>
              <span>{shortDateLabel(day.date)}</span>
            </header>

            <div className="planner-slots">
              {MEAL_SLOTS.map((slot) => {
                const entries = day.entries.filter((entry) => entry.slot === slot.value);
                const dropKey = `${day.date}:${slot.value}`;

                return (
                  <div
                    key={slot.value}
                    className={dragOverKey === dropKey ? "planner-slot drag-over" : "planner-slot"}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverKey(dropKey);
                    }}
                    onDragLeave={() => setDragOverKey((current) => (current === dropKey ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOverKey(null);
                      const recipeId = Number.parseInt(event.dataTransfer.getData("text/recipe-id"), 10);
                      const recipe = recipesById.get(recipeId);
                      if (recipe) {
                        addToSlot(day.date, slot.value, recipe);
                      }
                    }}
                  >
                    <span className="planner-slot-label">{slot.label}</span>

                    {entries.map((entry) => {
                      const recipe = entry.recipeId === null ? null : recipesById.get(entry.recipeId);
                      const title = recipe?.title ?? entry.customTitle ?? "Neznámý recept";

                      return (
                        <div key={entry.id} className="planner-entry">
                          <button
                            type="button"
                            className="planner-entry-title"
                            onClick={() => (recipe ? onOpenRecipe(recipe.id) : undefined)}
                            disabled={!recipe}
                          >
                            {title}
                          </button>
                          <button
                            type="button"
                            className="icon-button ghost"
                            onClick={() =>
                              commit(
                                (current) => mutations.removeMealPlanEntry(current, entry.id),
                                "Odebrání z plánu",
                              )
                            }
                            aria-label={`Odebrat ${title} z plánu`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      className="planner-add"
                      onClick={() => setPicker({ date: day.date, slot: slot.value })}
                      aria-label={`Přidat ${slot.label.toLowerCase()} na ${weekdayLabel(day.date)}`}
                    >
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-card">
        <div className="section-header">
          <h3>Recepty k přetažení</h3>
          <span className="muted-copy small">
            <CalendarRange size={14} aria-hidden="true" /> Na počítači přetáhni recept do dne.
          </span>
        </div>
        <div className="planner-drag-source">
          {state.recipes.slice(0, 30).map((recipe) => (
            <div
              key={recipe.id}
              className="planner-chip"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/recipe-id", `${recipe.id}`);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              {recipe.title}
            </div>
          ))}
        </div>
      </div>

      {picker ? (
        <Modal
          title={`${slotLabel(picker.slot)} — ${weekdayLabel(picker.date)} ${shortDateLabel(picker.date)}`}
          onClose={() => setPicker(null)}
          footer={
            <button type="button" className="secondary-button" onClick={() => setPicker(null)}>
              Zavřít
            </button>
          }
        >
          <RecipePickerList
            recipes={state.recipes}
            onSelect={(recipe) => addToSlot(picker.date, picker.slot, recipe)}
          />
        </Modal>
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          title="Vyprázdnit týden?"
          message={`Smaže se všech ${plannedCount} naplánovaných jídel v týdnu ${shortDateLabel(fromKey)} – ${shortDateLabel(toKey)}. Půjde to vzít zpět.`}
          confirmLabel="Vyprázdnit"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            commit(
              (current) => mutations.clearMealPlanRange(current, fromKey, toKey),
              "Vyprázdnění týdne",
            );
            setConfirmClear(false);
          }}
        />
      ) : null}
    </section>
  );
}
