"use client";

import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Timer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getUnitLabel, scaleAmount, type Recipe } from "@/lib/domain";
import { formatCountdown, formatDurationLabel, primaryDuration } from "@/lib/timers";
import { useToast } from "@/components/app/toast";
import { useWakeLock } from "./use-wake-lock";

/**
 * Režim vaření — celá obrazovka, velké písmo, krok po kroku.
 *
 * Tři věci, kvůli kterým to existuje:
 * - displej nezhasne (Wake Lock), takže se nemusí odemykat mokrýma rukama,
 * - ingredience jsou vidět u kroku, ne o dvě obrazovky výš,
 * - z textu kroku se pozná čas ("vař 20 minut") a jde z něj udělat časovač.
 */
export function CookMode({
  recipe,
  servings,
  onClose,
  onFinish,
}: {
  recipe: Recipe;
  servings?: number;
  onClose: () => void;
  onFinish: () => void;
}) {
  const { showToast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set());

  const steps = useMemo(() => {
    const list = recipe.steps ?? [];
    if (list.length > 0) {
      return list;
    }
    // Recept bez rozepsaného postupu má aspoň popis — lepší než prázdno.
    return recipe.description.trim().length > 0 ? [recipe.description.trim()] : [];
  }, [recipe.steps, recipe.description]);

  const { supported: wakeLockSupported, held: wakeLockHeld } = useWakeLock(true);

  const baseServings =
    typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
  const scaleFactor =
    baseServings !== null && servings && servings > 0 ? servings / baseServings : 1;

  const currentStep = steps[stepIndex] ?? "";
  const detectedDuration = useMemo(() => primaryDuration(currentStep), [currentStep]);

  const goTo = useCallback(
    (index: number) => {
      setStepIndex(Math.max(0, Math.min(steps.length - 1, index)));
    },
    [steps.length],
  );

  // Šipky vlevo/vpravo listují krokem, Escape zavírá.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        goTo(stepIndex + 1);
      } else if (event.key === "ArrowLeft") {
        goTo(stepIndex - 1);
      } else if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goTo, stepIndex, onClose]);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const isLastStep = stepIndex >= steps.length - 1;

  return (
    <div className="cook-mode" role="dialog" aria-modal="true" aria-label={`Vaříme: ${recipe.title}`}>
      <header className="cook-mode-header">
        <div className="cook-mode-heading">
          <p className="cook-mode-kicker">Vaříme</p>
          <h2>{recipe.title}</h2>
        </div>
        <div className="cook-mode-header-actions">
          {wakeLockSupported ? (
            <span
              className={wakeLockHeld ? "status-chip soft awake" : "status-chip soft"}
              title={
                wakeLockHeld
                  ? "Obrazovka zůstane rozsvícená."
                  : "Prohlížeč zrovna nedrží obrazovku rozsvícenou."
              }
            >
              <Lightbulb size={15} aria-hidden="true" />
              {wakeLockHeld ? "Displej svítí" : "Displej běžně"}
            </span>
          ) : null}
          <button type="button" className="icon-button glass" onClick={onClose} aria-label="Ukončit vaření">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="cook-mode-body">
        <section className="cook-mode-step">
          {steps.length > 0 ? (
            <>
              <p className="cook-mode-progress">
                Krok {stepIndex + 1} z {steps.length}
              </p>
              <div
                className="cook-mode-progress-bar"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={stepIndex + 1}
              >
                <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
              </div>
              <p className="cook-mode-step-text">{currentStep}</p>

              {detectedDuration ? (
                <StepTimer
                  key={`${stepIndex}-${detectedDuration.seconds}`}
                  seconds={detectedDuration.seconds}
                  label={detectedDuration.text}
                  onDone={() => showToast(`Časovač doběhl: ${detectedDuration.text}`)}
                />
              ) : null}
            </>
          ) : (
            <p className="cook-mode-step-text">
              Tenhle recept nemá rozepsaný postup. Ingredience máš vedle.
            </p>
          )}
        </section>

        <aside className="cook-mode-ingredients">
          <h3>Ingredience</h3>
          {servings && baseServings !== null && servings !== baseServings ? (
            <p className="muted-copy small">Přepočítáno na {servings} porcí.</p>
          ) : null}
          <ul>
            {recipe.ingredients.map((line, index) => {
              const amount =
                scaleFactor !== 1 ? scaleAmount(line.amountText, scaleFactor) : line.amountText;
              const checked = checkedIngredients.has(index);
              return (
                <li key={`${line.ingredientId ?? "custom"}-${index}`}>
                  <label className={checked ? "ingredient-check checked" : "ingredient-check"}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIngredient(index)}
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
                  </label>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>

      <footer className="cook-mode-footer">
        <button
          type="button"
          className="secondary-button"
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          Zpět
        </button>

        {isLastStep ? (
          <button type="button" className="primary-button" onClick={onFinish}>
            <Check size={18} aria-hidden="true" />
            Hotovo, zapsat vaření
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={() => goTo(stepIndex + 1)}>
            Další krok
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </footer>
    </div>
  );
}

/**
 * Odpočet navázaný na krok postupu.
 *
 * Čas se nepočítá přičítáním po sekundách — po uspání záložky prohlížeč
 * `setInterval` přiškrtí a odpočet by se rozešel s realitou. Místo toho se
 * pamatuje cílový čas a interval jen překresluje.
 */
function StepTimer({
  seconds,
  label,
  onDone,
}: {
  seconds: number;
  label: string;
  onDone: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!running) {
      return;
    }

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) {
        return;
      }
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (left === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        setRunning(false);
        announceTimerDone(label);
        onDone();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [running, label, onDone]);

  const start = () => {
    notifiedRef.current = false;
    deadlineRef.current = Date.now() + remaining * 1000;
    setRunning(true);
    void requestNotificationPermission();
  };

  const pause = () => {
    setRunning(false);
    deadlineRef.current = null;
  };

  const reset = () => {
    setRunning(false);
    deadlineRef.current = null;
    notifiedRef.current = false;
    setRemaining(seconds);
  };

  const finished = remaining === 0;

  return (
    <div className={finished ? "step-timer done" : "step-timer"}>
      <div className="step-timer-face">
        <Timer size={20} aria-hidden="true" />
        <span className="step-timer-value" aria-live="off">
          {formatCountdown(remaining)}
        </span>
        <span className="step-timer-label">
          {finished ? "Hotovo!" : `z ${formatDurationLabel(seconds)}`}
        </span>
      </div>

      <div className="step-timer-actions">
        {running ? (
          <button type="button" className="secondary-button" onClick={pause}>
            <Pause size={16} aria-hidden="true" />
            Pauza
          </button>
        ) : (
          <button type="button" className="primary-button" onClick={start} disabled={finished}>
            <Play size={16} aria-hidden="true" />
            {remaining === seconds ? `Spustit ${formatDurationLabel(seconds)}` : "Pokračovat"}
          </button>
        )}
        {remaining !== seconds ? (
          <button type="button" className="icon-button ghost" onClick={reset} aria-label="Vynulovat časovač">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {finished ? (
        <p className="step-timer-done-note">
          <Bell size={14} aria-hidden="true" />
          Čas vypršel.
        </p>
      ) : null}
    </div>
  );
}

async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "default") {
    return;
  }
  try {
    await Notification.requestPermission();
  } catch {
    // Odmítnutí je v pořádku — časovač funguje i bez notifikace.
  }
}

/** Upozorní i mimo záložku: systémová notifikace + krátká vibrace. */
function announceTimerDone(label: string): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("Recepty Terinky", { body: `Časovač doběhl: ${label}` });
    }
  } catch {
    // Některé prohlížeče vyžadují notifikace jen ze service workeru.
  }

  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate([200, 100, 200]);
  }
}
