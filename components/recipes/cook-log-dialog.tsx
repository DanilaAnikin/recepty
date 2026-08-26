"use client";

import { useState } from "react";

import type { Recipe } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { useAppState } from "@/components/app/app-state";
import { useToast } from "@/components/app/toast";
import { Modal } from "@/components/ui/modal";
import { StarRating } from "@/components/ui/primitives";

/**
 * Zápis do historie vaření.
 *
 * Původně se dal měnit jen holý počet vaření. Tady se ukládá i datum,
 * hodnocení a poznámka — což je přesně to, co odlišuje vlastní kuchařku
 * od receptu vygooglovaného pokaždé znovu.
 */
export function CookLogDialog({
  recipe,
  defaultServings,
  onClose,
}: {
  recipe: Recipe;
  defaultServings?: number;
  onClose: () => void;
}) {
  const { commit } = useAppState();
  const { showToast } = useToast();

  const [cookedOn, setCookedOn] = useState(() => toDateInputValue(new Date()));
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState("");
  const [servings, setServings] = useState(defaultServings ? `${defaultServings}` : "");

  const handleSave = () => {
    const parsedServings = Number.parseInt(servings, 10);

    commit(
      (current) =>
        mutations.addCookLogEntry(current, recipe.id, {
          // Uloží se poledne místo půlnoci, aby posun časové zóny nepřehodil
          // záznam na předchozí den.
          cookedAt: new Date(`${cookedOn}T12:00:00`).toISOString(),
          rating: rating > 0 ? rating : undefined,
          note: note.trim().length > 0 ? note.trim() : undefined,
          servings: Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : undefined,
        }),
      "Zápis vaření",
    );

    showToast("Zapsáno do historie.");
    onClose();
  };

  return (
    <Modal
      title="Zapsat vaření"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>
            Zrušit
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Uložit
          </button>
        </>
      }
    >
      <div className="content-stack compact">
        <label className="field-stack">
          <span>Kdy jsi to vařila</span>
          <input
            type="date"
            value={cookedOn}
            max={toDateInputValue(new Date())}
            onChange={(event) => setCookedOn(event.target.value)}
          />
        </label>

        <label className="field-stack">
          <span>Na kolik porcí</span>
          <input
            inputMode="numeric"
            value={servings}
            placeholder="nepovinné"
            onChange={(event) => setServings(event.target.value)}
          />
        </label>

        <div className="field-stack">
          <span>Jak to dopadlo</span>
          <StarRating value={rating > 0 ? rating : null} onChange={setRating} size={26} />
        </div>

        <label className="field-stack">
          <span>Poznámka</span>
          <textarea
            rows={3}
            value={note}
            placeholder="Příště míň soli, péct o 5 minut kratší dobu…"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}

/** `YYYY-MM-DD` v lokálním čase — `toISOString` by večer ukázal zítřek. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
