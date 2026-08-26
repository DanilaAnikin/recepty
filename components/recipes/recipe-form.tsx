"use client";

import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  INGREDIENT_UNITS,
  normalizeText,
  type IngredientUnit,
  type Recipe,
  type RecipeIngredient,
} from "@/lib/domain";
import { storeRecipeImage } from "@/lib/images";
import * as mutations from "@/lib/mutations";
import { deleteImage } from "@/lib/storage";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { Modal } from "@/components/ui/modal";
import { RecipeImage } from "@/components/ui/primitives";
import { IngredientPicker } from "@/components/ingredients/ingredient-picker";

/** Maximálně tolik fotek na recept — víc už je jen zabrané místo. */
const MAX_IMAGES = 5;

export type DraftIngredientRow = {
  rowId: string;
  ingredientId: number | null;
  name: string;
  amountText: string;
  unit: IngredientUnit;
};

export type RecipeFormValues = {
  recipeId: number | null;
  title: string;
  description: string;
  stepsText: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  tagsText: string;
  imageKeys: string[];
  imageUrls: string[];
  sourceUrl?: string;
  rows: DraftIngredientRow[];
};

export function createEmptyForm(): RecipeFormValues {
  return {
    recipeId: null,
    title: "",
    description: "",
    stepsText: "",
    servings: "",
    prepTime: "",
    cookTime: "",
    tagsText: "",
    imageKeys: [],
    imageUrls: [],
    rows: [createDraftRow()],
  };
}

export function formFromRecipe(recipe: Recipe): RecipeFormValues {
  return {
    recipeId: recipe.id,
    title: recipe.title,
    description: recipe.description,
    stepsText: (recipe.steps ?? []).join("\n"),
    servings: recipe.servings ? `${recipe.servings}` : "",
    prepTime: recipe.prepTimeMinutes ? `${recipe.prepTimeMinutes}` : "",
    cookTime: recipe.cookTimeMinutes ? `${recipe.cookTimeMinutes}` : "",
    tagsText: (recipe.tags ?? []).join(", "),
    imageKeys: recipe.imageKeys ?? [],
    imageUrls: recipe.imageUrls ?? [],
    sourceUrl: recipe.sourceUrl,
    rows:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((line) => ({
            rowId: createRowId(),
            ingredientId: line.ingredientId,
            name: line.ingredientNameSnapshot,
            amountText: line.amountText,
            unit: line.unit,
          }))
        : [createDraftRow()],
  };
}

export function RecipeForm({
  initialValues,
  onClose,
  onSaved,
}: {
  initialValues: RecipeFormValues;
  onClose: () => void;
  onSaved: (recipeId: number) => void;
}) {
  const { state, commit } = useAppState();
  const { showToast } = useToast();

  const [values, setValues] = useState<RecipeFormValues>(initialValues);
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  /** Fotky odebrané z formuláře — z databáze zmizí až po uložení. */
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  /** Fotky nahrané v tomhle formuláři — při zrušení se zase uklidí. */
  const [addedKeys, setAddedKeys] = useState<string[]>([]);

  const patch = (updates: Partial<RecipeFormValues>) => {
    setValues((current) => ({ ...current, ...updates }));
  };

  const updateRow = (rowId: string, updates: Partial<DraftIngredientRow>) => {
    setValues((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.rowId === rowId ? { ...row, ...updates } : row)),
    }));
  };

  const addRow = () => {
    setValues((current) => ({ ...current, rows: [...current.rows, createDraftRow()] }));
  };

  const removeRow = (rowId: string) => {
    setValues((current) => {
      const remaining = current.rows.filter((row) => row.rowId !== rowId);
      // Formulář nikdy nezůstane úplně bez řádku — prázdný seznam se špatně
      // doplňuje, když není kam kliknout.
      return { ...current, rows: remaining.length > 0 ? remaining : [createDraftRow()] };
    });
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const room = MAX_IMAGES - (values.imageKeys.length + values.imageUrls.length);
    if (room <= 0) {
      showToast(`Víc než ${MAX_IMAGES} fotek na recept nejde.`, { tone: "danger" });
      return;
    }

    setUploading(true);
    try {
      const selected = Array.from(files).slice(0, room);
      const keys = await Promise.all(selected.map((file) => storeRecipeImage(file)));
      setValues((current) => ({ ...current, imageKeys: [...current.imageKeys, ...keys] }));
      setAddedKeys((current) => [...current, ...keys]);
    } catch (error) {
      console.error("Recepty Terinky: uložení fotky selhalo", error);
      showToast("Fotku se nepodařilo uložit.", { tone: "danger" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (source: string, isKey: boolean) => {
    setValues((current) =>
      isKey
        ? { ...current, imageKeys: current.imageKeys.filter((key) => key !== source) }
        : { ...current, imageUrls: current.imageUrls.filter((url) => url !== source) },
    );
    if (isKey) {
      // Z databáze se maže až při uložení. Kdyby se mazalo hned a uživatel
      // formulář zavřel bez uložení, recept by odkazoval na fotku, která už
      // neexistuje.
      setRemovedKeys((current) => [...current, source]);
    }
  };

  const handleSave = () => {
    const problems: string[] = [];
    const title = values.title.trim();

    if (title.length === 0) {
      problems.push("Recept potřebuje název.");
    }

    const duplicate = state.recipes.find(
      (recipe) => recipe.normalizedTitle === normalizeText(title) && recipe.id !== values.recipeId,
    );
    if (title.length > 0 && duplicate) {
      problems.push(`Recept s názvem „${duplicate.title}" už existuje.`);
    }

    const filledRows = values.rows.filter((row) => row.name.trim().length > 0);
    if (filledRows.length === 0) {
      problems.push("Přidej aspoň jednu ingredienci.");
    }

    if (problems.length > 0) {
      setErrors(problems);
      return;
    }

    setErrors([]);

    // Id se určí předem, ne uvnitř updateru: potřebujeme ho vrátit volajícímu,
    // aby po uložení mohl otevřít detail právě vytvořeného receptu. Zakládání
    // ingrediencí id receptů neovlivňuje, takže je to bezpečné.
    const recipeId = values.recipeId ?? mutations.nextRecipeId(state);

    commit((current) => {
      let working = current;
      const ingredients: RecipeIngredient[] = [];

      for (const row of filledRows) {
        let ingredientId = row.ingredientId;
        let displayName = row.name.trim();

        // Ručně napsaná ingredience se založí, aby šla příště vybrat ze seznamu
        // a fungovalo na ni párování se spíží.
        if (ingredientId === null) {
          const added = mutations.addIngredient(working, displayName);
          working = added.state;
          ingredientId = added.ingredient.id;
          displayName = added.ingredient.name;
        }

        ingredients.push({
          ingredientId,
          ingredientNameSnapshot: displayName,
          normalizedIngredientName: normalizeText(displayName),
          amountText: row.amountText.trim(),
          unit: row.unit,
        });
      }

      const existing = working.recipes.find((recipe) => recipe.id === recipeId);
      const timestamp = new Date().toISOString();

      const recipe: Recipe = {
        id: recipeId,
        title,
        normalizedTitle: normalizeText(title),
        description: values.description.trim(),
        imagePath: existing?.imagePath ?? null,
        imageKeys: values.imageKeys,
        imageUrls: values.imageUrls,
        steps: parseSteps(values.stepsText),
        tags: parseTags(values.tagsText),
        servings: parsePositiveInt(values.servings),
        prepTimeMinutes: parsePositiveInt(values.prepTime),
        cookTimeMinutes: parsePositiveInt(values.cookTime),
        cookingCount: existing?.cookingCount ?? 0,
        cookLog: existing?.cookLog ?? [],
        isFavorite: existing?.isFavorite ?? false,
        rating: existing?.rating,
        notes: existing?.notes,
        sourceUrl: values.sourceUrl ?? existing?.sourceUrl,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        ingredients,
      };

      return mutations.upsertRecipe(working, recipe);
    }, values.recipeId ? "Úprava receptu" : "Nový recept");

    // Teprve teď je jisté, že odebrané fotky opravdu nikdo nepotřebuje.
    for (const key of removedKeys) {
      void deleteImage(key);
    }

    showToast(values.recipeId ? "Recept uložen." : "Recept přidán.");
    onSaved(recipeId);
  };

  /** Zrušení formuláře uklidí fotky, které v něm vznikly a nikam se neuloží. */
  const handleClose = () => {
    for (const key of addedKeys) {
      if (values.imageKeys.includes(key)) {
        void deleteImage(key);
      }
    }
    onClose();
  };

  const allImages = [
    ...values.imageKeys.map((key) => ({ source: key, isKey: true })),
    ...values.imageUrls.map((url) => ({ source: url, isKey: false })),
  ];

  return (
    <>
      <Modal
        title={values.recipeId ? "Upravit recept" : "Nový recept"}
        onClose={handleClose}
        size="wide"
        footer={
          <>
            <button type="button" className="secondary-button" onClick={handleClose}>
              Zavřít
            </button>
            <button type="button" className="primary-button" onClick={handleSave}>
              Uložit recept
            </button>
          </>
        }
      >
        <div className="content-stack">
          {errors.length > 0 ? (
            <div className="form-errors" role="alert">
              {errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <section className="form-card">
            <label className="field-stack">
              <span>Název receptu</span>
              <input
                value={values.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="Např. Babiččin jablečný závin"
              />
            </label>

            <label className="field-stack">
              <span>Popis / poznámka</span>
              <textarea
                rows={3}
                placeholder="Krátký popis jídla nebo poznámka"
                value={values.description}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </label>

            <label className="field-stack">
              <span>Postup (každý krok na nový řádek)</span>
              <textarea
                rows={6}
                placeholder={"Troubu předehřej na 180 °C.\nMouku smíchej s cukrem.\nPeč 40 minut."}
                value={values.stepsText}
                onChange={(event) => patch({ stepsText: event.target.value })}
              />
              <span className="field-hint">
                Když v kroku napíšeš čas („peč 40 minut&ldquo;), režim vaření z něj udělá časovač.
              </span>
            </label>

            <div className="inline-fields recipe-meta-fields">
              <label className="field-stack">
                <span>Počet porcí</span>
                <input
                  inputMode="numeric"
                  value={values.servings}
                  onChange={(event) => patch({ servings: event.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Příprava (min)</span>
                <input
                  inputMode="numeric"
                  value={values.prepTime}
                  onChange={(event) => patch({ prepTime: event.target.value })}
                />
              </label>
              <label className="field-stack">
                <span>Vaření (min)</span>
                <input
                  inputMode="numeric"
                  value={values.cookTime}
                  onChange={(event) => patch({ cookTime: event.target.value })}
                />
              </label>
            </div>

            <label className="field-stack">
              <span>Štítky (oddělené čárkou)</span>
              <input
                value={values.tagsText}
                placeholder="rychlé, bezmasé, oběd"
                onChange={(event) => patch({ tagsText: event.target.value })}
              />
            </label>
          </section>

          <section className="form-card">
            <div className="section-header">
              <h4>Fotky</h4>
              <label className="secondary-button file-button">
                <ImagePlus size={16} aria-hidden="true" />
                {uploading ? "Ukládám…" : "Přidat fotku"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading || allImages.length >= MAX_IMAGES}
                  onChange={(event) => {
                    void handleAddImages(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {allImages.length === 0 ? (
              <p className="muted-copy small">
                Zatím žádná fotka. Ukládají se komprimované rovnou do prohlížeče.
              </p>
            ) : (
              <div className="image-grid">
                {allImages.map(({ source, isKey }) => (
                  <div key={source} className="image-grid-item">
                    <RecipeImage source={source} alt="Fotka receptu" large />
                    <button
                      type="button"
                      className="icon-button danger image-remove"
                      onClick={() => handleRemoveImage(source, isKey)}
                      aria-label="Odebrat fotku"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="form-card">
            <div className="section-header">
              <h4>Ingredience</h4>
              <button type="button" className="secondary-button" onClick={addRow}>
                <Plus size={16} aria-hidden="true" />
                Přidat řádek
              </button>
            </div>

            <div className="content-stack compact">
              {values.rows.map((row) => (
                <div key={row.rowId} className="ingredient-form-row">
                  <button
                    type="button"
                    className="ingredient-pick-button"
                    onClick={() => setPickerRowId(row.rowId)}
                  >
                    <div>
                      <strong>{row.name.trim().length > 0 ? row.name : "Vyber ingredienci"}</strong>
                      <span>
                        {row.ingredientId === null && row.name.trim().length > 0
                          ? "Vytvoří se jako nová ingredience"
                          : "Klepnutím vybereš ze seznamu"}
                      </span>
                    </div>
                  </button>

                  <div className="inline-fields">
                    <label className="field-stack">
                      <span>Množství</span>
                      <input
                        value={row.amountText}
                        placeholder="200, 1/2, špetka…"
                        onChange={(event) => updateRow(row.rowId, { amountText: event.target.value })}
                      />
                    </label>

                    <label className="field-stack">
                      <span>Jednotka</span>
                      <select
                        value={row.unit}
                        onChange={(event) =>
                          updateRow(row.rowId, { unit: event.target.value as IngredientUnit })
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
                      onClick={() => removeRow(row.rowId)}
                      aria-label="Odebrat řádek ingredience"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>

      {pickerRowId ? (
        <IngredientPicker
          onClose={() => setPickerRowId(null)}
          onSelect={(ingredient) => {
            updateRow(pickerRowId, { ingredientId: ingredient.id, name: ingredient.name });
            setPickerRowId(null);
          }}
        />
      ) : null}
    </>
  );
}

export function createDraftRow(): DraftIngredientRow {
  return { rowId: createRowId(), ingredientId: null, name: "", amountText: "", unit: "g" };
}

let rowCounter = 0;
function createRowId(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of value.split(",")) {
    const tag = raw.trim();
    const normalized = normalizeText(tag);
    if (tag.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(tag);
  }

  return tags;
}

export function parseSteps(value: string): string[] {
  return value
    .split(/\r?\n/)
    // Číslování na začátku řádku zahazujeme — seznam se čísluje sám a jinak
    // by v postupu bylo "1. 1. Smíchej".
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter((line) => line.length > 0);
}
