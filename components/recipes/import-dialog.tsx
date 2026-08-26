"use client";

import { ClipboardPaste, Link2, Loader2 } from "lucide-react";
import { useState } from "react";

import type { ImportedRecipe } from "@/lib/recipe-import";
import { parseRecipeFromText } from "@/lib/recipe-import";
import { Modal } from "@/components/ui/modal";
import { createDraftRow, type RecipeFormValues } from "./recipe-form";

/**
 * Import receptu odjinud.
 *
 * Dvě cesty: adresa webu (server stránku stáhne a přečte z ní JSON-LD, který
 * mají food blogy kvůli Googlu) nebo prostě nakopírovaný text. Výsledek se
 * nikdy neuloží rovnou — vždycky skončí v předvyplněném formuláři ke kontrole.
 */
export function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (values: RecipeFormValues) => void;
}) {
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImportUrl = async () => {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      setError("Vlož adresu receptu.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const body = (await response.json()) as { recipe?: ImportedRecipe; error?: string };

      if (!response.ok || !body.recipe) {
        setError(body.error ?? "Recept se nepodařilo načíst.");
        return;
      }

      onImported(toFormValues(body.recipe));
    } catch {
      setError("Server neodpověděl. Zkontroluj připojení.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportText = () => {
    if (text.trim().length === 0) {
      setError("Vlož text receptu.");
      return;
    }
    const parsed = parseRecipeFromText(text);
    if (parsed.title.length === 0 && parsed.ingredients.length === 0) {
      setError("Z textu se nepodařilo nic vyčíst.");
      return;
    }
    onImported(toFormValues(parsed));
  };

  return (
    <Modal
      title="Importovat recept"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>
            Zrušit
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={loading}
            onClick={() => (mode === "url" ? void handleImportUrl() : handleImportText())}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Načítám…
              </>
            ) : (
              "Načíst do formuláře"
            )}
          </button>
        </>
      }
    >
      <div className="content-stack compact">
        <div className="segmented-control" role="group" aria-label="Způsob importu">
          <button
            type="button"
            className={mode === "url" ? "segment-button active" : "segment-button"}
            onClick={() => {
              setMode("url");
              setError(null);
            }}
          >
            <Link2 size={15} aria-hidden="true" />
            Z odkazu
          </button>
          <button
            type="button"
            className={mode === "text" ? "segment-button active" : "segment-button"}
            onClick={() => {
              setMode("text");
              setError(null);
            }}
          >
            <ClipboardPaste size={15} aria-hidden="true" />
            Z textu
          </button>
        </div>

        {mode === "url" ? (
          <label className="field-stack">
            <span>Adresa receptu</span>
            <input
              autoFocus
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://…"
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleImportUrl();
                }
              }}
            />
            <span className="field-hint">
              Funguje na většině receptových webů. Když stránka recept strojově
              nepopisuje, zkus záložku „Z textu&ldquo;.
            </span>
          </label>
        ) : (
          <label className="field-stack">
            <span>Text receptu</span>
            <textarea
              autoFocus
              rows={12}
              value={text}
              placeholder={
                "Palačinky\nIngredience:\n200 g hladké mouky\n2 vejce\n300 ml mléka\nPostup:\nVšechno smíchej.\nSmaž na pánvi."
              }
              onChange={(event) => setText(event.target.value)}
            />
            <span className="field-hint">
              První řádek je název. Nadpisy „Ingredience:&ldquo; a „Postup:&ldquo; pomůžou,
              ale nejsou povinné.
            </span>
          </label>
        )}

        {error ? (
          <p className="form-errors" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** Naimportovaný recept -> hodnoty formuláře, ať to jde před uložením zkontrolovat. */
export function toFormValues(imported: ImportedRecipe): RecipeFormValues {
  return {
    recipeId: null,
    title: imported.title,
    description: imported.description,
    stepsText: imported.steps.join("\n"),
    servings: imported.servings ? `${imported.servings}` : "",
    prepTime: imported.prepTimeMinutes ? `${imported.prepTimeMinutes}` : "",
    cookTime: imported.cookTimeMinutes ? `${imported.cookTimeMinutes}` : "",
    tagsText: imported.tags.join(", "),
    imageKeys: [],
    imageUrls: imported.imageUrls,
    sourceUrl: imported.sourceUrl,
    rows:
      imported.ingredients.length > 0
        ? imported.ingredients.map((ingredient) => ({
            ...createDraftRow(),
            name: ingredient.name,
            amountText: ingredient.amount,
            unit: ingredient.unit,
          }))
        : [createDraftRow()],
  };
}
