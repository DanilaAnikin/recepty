"use client";

import {
  CalendarPlus,
  Check,
  ChefHat,
  Clock,
  Heart,
  HeartOff,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Share2,
  ShoppingCart,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  averageRating,
  getUnitLabel,
  pantryIdSet,
  scaleAmount,
  type Recipe,
} from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { recipeToText } from "@/lib/recipe-text";
import { buildShoppingItems } from "@/lib/shopping";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { recipeShareUrl } from "@/components/app/use-route";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog, RecipeImage, StarRating } from "@/components/ui/primitives";
import { formatMinutes } from "./recipes-tab";
import { CookLogDialog } from "./cook-log-dialog";

export function RecipeDetail({
  recipe,
  onClose,
  onEdit,
  onStartCooking,
  onPlan,
}: {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
  onStartCooking: () => void;
  onPlan: () => void;
}) {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const baseServings =
    typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
  const [viewServings, setViewServings] = useState<number | null>(baseServings);
  const [checkedLines, setCheckedLines] = useState<Set<number>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cookLogOpen, setCookLogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(recipe.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);

  const pantryIds = useMemo(() => pantryIdSet(state.pantry), [state.pantry]);

  const scaleFactor =
    baseServings !== null && viewServings !== null && viewServings > 0
      ? viewServings / baseServings
      : 1;

  const totalTime =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0) || null;

  const rating = averageRating(recipe);
  const cookLog = useMemo(
    () => [...(recipe.cookLog ?? [])].sort((left, right) => right.cookedAt.localeCompare(left.cookedAt)),
    [recipe.cookLog],
  );

  const galleryImages = useMemo(() => {
    const keys = recipe.imageKeys ?? [];
    const urls = recipe.imageUrls ?? [];
    return [...keys, ...urls].slice(1);
  }, [recipe.imageKeys, recipe.imageUrls]);

  const heroImage = recipe.imageKeys?.[0] ?? recipe.imageUrls?.[0] ?? recipe.imagePath;

  const toggleLine = (index: number) => {
    setCheckedLines((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddToShoppingList = () => {
    const items = buildShoppingItems([{ recipe, servings: viewServings ?? undefined }], {
      pantryIds,
      skipPantry: true,
      source: "recipe",
    });

    if (items.length === 0) {
      showToast("Všechno na tenhle recept už máš doma.");
      return;
    }

    commit((current) => mutations.addShoppingItems(current, items), "Přidání do nákupu");
    showToast(`Do nákupu přidáno ${items.length} ${pluralItems(items.length)}.`);
  };

  const handleShare = async () => {
    const text = recipeToText(recipe, {
      servings: viewServings ?? undefined,
      url: recipeShareUrl(recipe.id),
    });

    // `navigator.share` je na mobilu to pravé; na desktopu obvykle chybí,
    // tak se text aspoň zkopíruje do schránky.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: recipe.title, text });
        return;
      } catch (error) {
        // Zrušení uživatelem není chyba, kterou by bylo potřeba hlásit.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast("Recept zkopírován do schránky.");
    } catch {
      showToast("Sdílení se nepodařilo.", { tone: "danger" });
    }
  };

  const handleSaveNotes = () => {
    commit((current) => mutations.setRecipeNotes(current, recipe.id, notesDraft), "Poznámka k receptu");
    setNotesDirty(false);
    showToast("Poznámka uložena.");
  };

  const handleDelete = () => {
    const snapshot = state;
    commit((current) => mutations.deleteRecipe(current, recipe.id), "Smazání receptu");
    setConfirmDelete(false);
    onClose();
    showToast(`Recept „${recipe.title}" byl smazán.`, {
      action: {
        label: "Zpět",
        onClick: () => commit(() => snapshot, "Obnovení receptu"),
      },
    });
  };

  return (
    <>
      <Modal
        title={recipe.title}
        onClose={onClose}
        size="wide"
        bodyClassName="printable-recipe"
        footer={
          <>
            {/* Na mobilu se skrývá: sheet zavře křížek v hlavičce i systémové
                Zpět, takže by tlačítko jen ubíralo místo hlavní akci. */}
            <button type="button" className="secondary-button redundant-close" onClick={onClose}>
              Zavřít
            </button>
            <button type="button" className="secondary-button" onClick={onEdit}>
              <Pencil size={16} aria-hidden="true" />
              Upravit
            </button>
            <button
              type="button"
              className="secondary-button danger-text"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} aria-hidden="true" />
              Smazat
            </button>
            <button type="button" className="primary-button" onClick={onStartCooking}>
              <Utensils size={16} aria-hidden="true" />
              Vařit
            </button>
          </>
        }
      >
        <div className="content-stack">
          <section className="detail-hero">
            <div className="content-stack compact grow">
              <h3 className="detail-title">{recipe.title}</h3>

              <div className="meta-row">
                <span className="meta-chip">
                  <ChefHat size={16} aria-hidden="true" />
                  {recipe.ingredients.length} ingrediencí
                </span>
                <span className="meta-chip">
                  <Utensils size={16} aria-hidden="true" />
                  {recipe.cookingCount}× uvařeno
                </span>
                {totalTime ? (
                  <span className="meta-chip">
                    <Clock size={16} aria-hidden="true" />
                    {formatMinutes(totalTime)}
                  </span>
                ) : null}
                {baseServings !== null ? (
                  <span className="meta-chip">
                    <Users size={16} aria-hidden="true" />
                    {baseServings} porcí
                  </span>
                ) : null}
              </div>

              <div className="rating-row no-print">
                <span className="filter-group-label">Hodnocení</span>
                <StarRating
                  value={rating}
                  onChange={(next) =>
                    commit(
                      (current) => mutations.setRecipeRating(current, recipe.id, next),
                      "Hodnocení receptu",
                    )
                  }
                />
              </div>

              {recipe.tags && recipe.tags.length > 0 ? (
                <div className="tag-chip-row">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="toolbar-wrap detail-actions no-print">
                <button type="button" className="secondary-button" onClick={() => setCookLogOpen(true)}>
                  <Plus size={16} aria-hidden="true" />
                  Zapsat vaření
                </button>
                <button type="button" className="secondary-button" onClick={handleAddToShoppingList}>
                  <ShoppingCart size={16} aria-hidden="true" />
                  Do nákupu
                </button>
                <button type="button" className="secondary-button" onClick={onPlan}>
                  <CalendarPlus size={16} aria-hidden="true" />
                  Naplánovat
                </button>
                <button type="button" className="secondary-button" onClick={() => void handleShare()}>
                  <Share2 size={16} aria-hidden="true" />
                  Sdílet
                </button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>
                  <Printer size={16} aria-hidden="true" />
                  Tisk
                </button>
                <button
                  type="button"
                  className={
                    recipe.isFavorite
                      ? "secondary-button favorite-button active"
                      : "secondary-button favorite-button"
                  }
                  aria-pressed={recipe.isFavorite === true}
                  onClick={() =>
                    commit(
                      (current) => mutations.toggleRecipeFavorite(current, recipe.id),
                      "Oblíbené",
                    )
                  }
                >
                  {recipe.isFavorite ? (
                    <Heart size={16} aria-hidden="true" />
                  ) : (
                    <HeartOff size={16} aria-hidden="true" />
                  )}
                  Oblíbené
                </button>
              </div>
            </div>

            {heroImage ? <RecipeImage source={heroImage} alt={recipe.title} large /> : null}
          </section>

          {galleryImages.length > 0 ? (
            <section className="recipe-gallery no-print">
              {galleryImages.map((source, index) => (
                <GalleryItem key={source} source={source} alt={`${recipe.title} – fotka ${index + 2}`} />
              ))}
            </section>
          ) : null}

          {recipe.description.trim().length > 0 ? (
            <section className="form-card">
              <h4>Popis</h4>
              <p className="multiline-copy">{recipe.description}</p>
            </section>
          ) : null}

          <section className="form-card">
            <div className="section-header">
              <h4>Ingredience</h4>

              {baseServings !== null && viewServings !== null ? (
                <div className="servings-stepper no-print">
                  <span className="servings-stepper-label">Porce</span>
                  <button
                    type="button"
                    className="icon-button ghost"
                    onClick={() => setViewServings(Math.max(1, viewServings - 1))}
                    disabled={viewServings <= 1}
                    aria-label="Méně porcí"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <span className="servings-stepper-value">{viewServings}</span>
                  <button
                    type="button"
                    className="icon-button ghost"
                    onClick={() => setViewServings(viewServings + 1)}
                    aria-label="Více porcí"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                  {viewServings !== baseServings ? (
                    <button
                      type="button"
                      className="icon-button ghost"
                      onClick={() => setViewServings(baseServings)}
                      aria-label="Obnovit původní počet porcí"
                    >
                      <RotateCcw size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <ul className="ingredient-checklist">
              {recipe.ingredients.map((line, index) => {
                const amount =
                  scaleFactor !== 1 ? scaleAmount(line.amountText, scaleFactor) : line.amountText;
                const atHome = line.ingredientId !== null && pantryIds.has(line.ingredientId);
                const checked = checkedLines.has(index);

                return (
                  <li key={`${line.ingredientId ?? "custom"}-${index}`}>
                    <label className={checked ? "ingredient-check checked" : "ingredient-check"}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLine(index)}
                        aria-label={`Odškrtnout ${line.ingredientNameSnapshot}`}
                      />
                      <span className="ingredient-check-body">
                        <span className="ingredient-check-name">{line.ingredientNameSnapshot}</span>
                        {line.amountText.trim().length > 0 ? (
                          <span className="ingredient-check-amount">
                            {amount} {getUnitLabel(line.unit)}
                          </span>
                        ) : null}
                      </span>
                      {atHome ? (
                        <span className="pantry-badge no-print" title="Tohle máš doma">
                          <Check size={12} aria-hidden="true" />
                          doma
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>

            {checkedLines.size > 0 ? (
              <button
                type="button"
                className="ghost-button align-start no-print"
                onClick={() => setCheckedLines(new Set())}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Zrušit odškrtnutí
              </button>
            ) : null}
          </section>

          <section className="form-card">
            <h4>Postup</h4>
            {(recipe.steps?.length ?? 0) > 0 ? (
              <ol className="recipe-steps">
                {(recipe.steps ?? []).map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="multiline-copy">
                {recipe.description.trim().length > 0 ? recipe.description : "Zatím bez postupu."}
              </p>
            )}
          </section>

          <section className="form-card no-print">
            <h4>Moje poznámka</h4>
            <p className="muted-copy small">
              Sem patří to, co v receptu nestojí — „příště míň soli&ldquo;, „peče se rychleji&ldquo;.
            </p>
            <textarea
              rows={3}
              value={notesDraft}
              placeholder="Co si chceš k receptu zapamatovat?"
              onChange={(event) => {
                setNotesDraft(event.target.value);
                setNotesDirty(true);
              }}
              aria-label="Poznámka k receptu"
            />
            {notesDirty ? (
              <button type="button" className="secondary-button align-start" onClick={handleSaveNotes}>
                <Check size={15} aria-hidden="true" />
                Uložit poznámku
              </button>
            ) : null}
          </section>

          {cookLog.length > 0 ? (
            <section className="form-card no-print">
              <h4>Historie vaření</h4>
              <ul className="cook-log">
                {cookLog.map((entry) => (
                  <li key={entry.id} className="cook-log-entry">
                    <div className="cook-log-main">
                      <span className="cook-log-date">{formatCookDate(entry.cookedAt)}</span>
                      {entry.rating ? <StarRating value={entry.rating} size={13} /> : null}
                      {entry.note ? <span className="cook-log-note">{entry.note}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="icon-button ghost danger"
                      onClick={() =>
                        commit(
                          (current) => mutations.removeCookLogEntry(current, recipe.id, entry.id),
                          "Smazání záznamu vaření",
                        )
                      }
                      aria-label="Smazat záznam"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {recipe.sourceUrl ? (
            <p className="muted-copy small no-print">
              Zdroj:{" "}
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer noopener">
                {recipe.sourceUrl}
              </a>
            </p>
          ) : null}
        </div>
      </Modal>

      {cookLogOpen ? (
        <CookLogDialog
          recipe={recipe}
          defaultServings={viewServings ?? undefined}
          onClose={() => setCookLogOpen(false)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="Smazat recept?"
          message={`Opravdu chceš smazat „${recipe.title}"? Půjde to hned vzít zpět.`}
          confirmLabel="Smazat"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </>
  );
}

function GalleryItem({ source, alt }: { source: string; alt: string }) {
  return (
    <div className="recipe-gallery-item">
      <RecipeImage source={source} alt={alt} large />
    </div>
  );
}

export function formatCookDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function pluralItems(count: number): string {
  if (count === 1) return "položka";
  if (count >= 2 && count <= 4) return "položky";
  return "položek";
}
