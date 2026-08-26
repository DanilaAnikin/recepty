"use client";

import {
  CalendarRange,
  ChefHat,
  Database,
  Loader2,
  Redo2,
  ShoppingBasket,
  ShoppingCart,
  Undo2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveTheme, type Recipe } from "@/lib/domain";
import * as mutations from "@/lib/mutations";
import { toDateKey } from "@/lib/planner";
import { AppStateProvider, useAppState } from "@/components/app/app-state";
import { ToastProvider, useToast } from "@/components/app/toast";
import { useRoute, type AppTab } from "@/components/app/use-route";
import { usePrefersDark } from "@/components/app/use-media-query";
import { ThemeMenu } from "@/components/app/theme-menu";
import { IngredientsTab } from "@/components/ingredients/ingredients-tab";
import { PlannerTab } from "@/components/planner/planner-tab";
import { CookMode } from "@/components/recipes/cook-mode";
import { CookLogDialog } from "@/components/recipes/cook-log-dialog";
import { ImportDialog } from "@/components/recipes/import-dialog";
import {
  RecipeForm,
  createEmptyForm,
  formFromRecipe,
  type RecipeFormValues,
} from "@/components/recipes/recipe-form";
import { RecipeDetail } from "@/components/recipes/recipe-detail";
import { RecipesTab } from "@/components/recipes/recipes-tab";
import { DataDialog } from "@/components/settings/data-dialog";
import { ShoppingTab } from "@/components/shopping/shopping-tab";
import { Modal } from "@/components/ui/modal";
import { MEAL_SLOTS, type MealSlot } from "@/lib/domain";

/** Kolik změn musí ve stavu vzniknout, než má smysl připomínat zálohu. */
const MIN_REVISION_FOR_BACKUP_NUDGE = 25;

const TABS: Array<{ value: AppTab; label: string; icon: typeof ChefHat }> = [
  { value: "recipes", label: "Recepty", icon: ChefHat },
  { value: "ingredients", label: "Ingredience", icon: ShoppingBasket },
  { value: "shopping", label: "Nákup", icon: ShoppingCart },
  { value: "planner", label: "Plán", icon: CalendarRange },
];

export function ReceptyTerinkyApp() {
  return (
    <AppStateProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppStateProvider>
  );
}

function AppShell() {
  const { state, hydrated, commit, undo, redo, canUndo, canRedo, undoLabel, redoLabel, storageError, clearStorageError } =
    useAppState();
  const { showToast } = useToast();
  const { route, navigate, back } = useRoute();

  const [recipeForm, setRecipeForm] = useState<RecipeFormValues | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null);
  const [cookLogRecipe, setCookLogRecipe] = useState<Recipe | null>(null);
  const prefersDark = usePrefersDark();

  const selectedRecipe = useMemo(
    () => (route.recipeId === null ? null : state.recipes.find((r) => r.id === route.recipeId) ?? null),
    [route.recipeId, state.recipes],
  );

  // Motiv: sleduje systémové nastavení, pokud si uživatel nevybral napevno.
  useEffect(() => {
    const resolved = resolveTheme(state.themeMode, prefersDark);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [state.themeMode, prefersDark]);

  // Registrace service workeru — bez něj aplikace v kuchyni bez signálu nenaběhne.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Recepty Terinky: registrace service workeru selhala", error);
    });
  }, []);

  // Vyčerpaná kvóta úložiště je jediná chyba, kterou musí uživatel vidět —
  // od té chvíle se totiž data přestanou ukládat.
  useEffect(() => {
    if (!storageError) {
      return;
    }
    showToast(
      "Nepodařilo se uložit data — dochází místo. Stáhni si zálohu a smaž nějaké fotky.",
      { tone: "danger" },
    );
    clearStorageError();
  }, [storageError, showToast, clearStorageError]);

  // Připomínka zálohy.
  //
  // Snapshoty v IndexedDB pomůžou, když se pokazí data — ale ne když si někdo
  // smaže data prohlížeče nebo přejde na nový telefon. Na to je potřeba soubor,
  // takže po měsíci bez zálohy jednou (a nevtíravě) připomeneme.
  //
  // Čeká se, až v aplikaci něco vlastního opravdu vznikne (`revision`). Nemá
  // smysl strašit někoho, kdo appku otevřel poprvé a má v ní jen výchozí data.
  const backupNudgeShown = useRef(false);
  useEffect(() => {
    if (!hydrated || backupNudgeShown.current || state.revision < MIN_REVISION_FOR_BACKUP_NUDGE) {
      return;
    }

    const lastBackup = state.lastBackupAt ? Date.parse(state.lastBackupAt) : null;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (lastBackup !== null && !Number.isNaN(lastBackup) && lastBackup > monthAgo) {
      return;
    }

    backupNudgeShown.current = true;
    const timer = setTimeout(() => {
      showToast(
        lastBackup === null
          ? "Zálohu sis ještě nikdy nestáhla. Data žijí jen v tomhle prohlížeči."
          : "Poslední záloha je starší než měsíc.",
        { action: { label: "Zálohovat", onClick: () => setDataDialogOpen(true) } },
      );
    }, 3000);

    return () => clearTimeout(timer);
  }, [hydrated, state.lastBackupAt, state.revision, showToast]);

  // Odkaz na recept, který mezitím zmizel (smazaný, nebo z cizí zálohy).
  useEffect(() => {
    if (hydrated && route.recipeId !== null && selectedRecipe === null) {
      navigate({ recipeId: null, cooking: false }, { replace: true });
    }
  }, [hydrated, route.recipeId, selectedRecipe, navigate]);

  const openRecipe = (recipeId: number) => navigate({ recipeId, cooking: false });
  const closeRecipe = () => {
    // Zavřít přes historii, aby systémové Zpět a křížek dělaly totéž.
    if (window.history.state !== null || window.location.search.includes("recept=")) {
      back();
    } else {
      navigate({ recipeId: null, cooking: false }, { replace: true });
    }
  };

  const pendingShoppingCount = state.shoppingList.filter((item) => !item.checked).length;

  return (
    <div className="app-shell">
      <div className="background-blob blob-one" aria-hidden="true" />
      <div className="background-blob blob-two" aria-hidden="true" />
      <div className="background-blob blob-three" aria-hidden="true" />

      <a className="skip-link" href="#hlavni-obsah">
        Přeskočit na obsah
      </a>

      <main className="app-frame">
        <section className="hero-card">
          <div className="hero-topline">
            <div className="hero-branding">
              <span className="hero-kicker">Domácí kuchařka pro každý den</span>
              <Image
                src="/branding/logo_wordmark.png"
                alt="Recepty Terinky"
                className="hero-logo"
                width={455}
                height={110}
                priority
              />
            </div>

            <div className="hero-actions">
              {state.pantry.length > 0 ? (
                <span className="status-chip">
                  <ShoppingBasket size={16} aria-hidden="true" />
                  {state.pantry.length} doma
                </span>
              ) : (
                <span className="status-chip soft">Zásoby připravené k filtrování</span>
              )}

              <button
                type="button"
                className="icon-button glass"
                onClick={undo}
                disabled={!canUndo}
                aria-label={canUndo ? `Zpět: ${undoLabel}` : "Zpět"}
                title={canUndo ? `Zpět: ${undoLabel}` : "Není co vrátit"}
              >
                <Undo2 size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button glass"
                onClick={redo}
                disabled={!canRedo}
                aria-label={canRedo ? `Znovu: ${redoLabel}` : "Znovu"}
                title={canRedo ? `Znovu: ${redoLabel}` : "Není co zopakovat"}
              >
                <Redo2 size={18} aria-hidden="true" />
              </button>

              <button
                type="button"
                className="icon-button glass"
                aria-label="Data a zálohy"
                onClick={() => setDataDialogOpen(true)}
              >
                <Database size={18} aria-hidden="true" />
              </button>

              <ThemeMenu
                currentMode={state.themeMode}
                onSelect={(themeMode) =>
                  commit((current) => mutations.setThemeMode(current, themeMode), "Změna motivu", {
                    track: false,
                  })
                }
              />
            </div>
          </div>

          <div className="hero-copy">
            <h1>Recepty, zásoby, nákup a plán na týden v jednom.</h1>
            <p>
              Najdeš rychle, co máš doma, co chceš vařit a co je potřeba dokoupit.
              Bez chaosu a bez přepínání mezi pěti appkami.
            </p>
          </div>

          <div className="hero-bottom">
            <nav className="tab-switch" aria-label="Hlavní navigace">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={route.tab === tab.value ? "tab-button active" : "tab-button"}
                  onClick={() => navigate({ tab: tab.value })}
                  aria-current={route.tab === tab.value ? "page" : undefined}
                >
                  {tab.label}
                  {tab.value === "shopping" && pendingShoppingCount > 0 ? (
                    <span className="tab-badge">{pendingShoppingCount}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
        </section>

        <div id="hlavni-obsah">
          {/* Obsah se vykreslí až po načtení dat z IndexedDB. Jinak by aplikace
              chvíli nabízela prázdný seed jako by to byla skutečná data a rychlé
              klepnutí by se ztratilo — hydratace by ho hned přepsala. */}
          {!hydrated ? (
            <div className="panel-card loading-panel" role="status" aria-live="polite">
              <Loader2 size={20} className="spin" aria-hidden="true" />
              Načítám tvoji kuchařku…
            </div>
          ) : (
            <>
              {route.tab === "recipes" ? (
                <RecipesTab
                  onOpenRecipe={openRecipe}
                  onCreateRecipe={() => setRecipeForm(createEmptyForm())}
                  onImportRecipe={() => setImportOpen(true)}
                />
              ) : null}

              {route.tab === "ingredients" ? <IngredientsTab /> : null}

              {route.tab === "shopping" ? (
                <ShoppingTab onOpenPlanner={() => navigate({ tab: "planner" })} />
              ) : null}

              {route.tab === "planner" ? <PlannerTab onOpenRecipe={openRecipe} /> : null}
            </>
          )}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Hlavní navigace">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              className={route.tab === tab.value ? "bottom-nav-button active" : "bottom-nav-button"}
              onClick={() => navigate({ tab: tab.value })}
              aria-current={route.tab === tab.value ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {tab.label}
              {tab.value === "shopping" && pendingShoppingCount > 0 ? (
                <span className="tab-badge">{pendingShoppingCount}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {hydrated && selectedRecipe && !route.cooking ? (
        <RecipeDetail
          recipe={selectedRecipe}
          onClose={closeRecipe}
          onEdit={() => setRecipeForm(formFromRecipe(selectedRecipe))}
          onStartCooking={() => navigate({ cooking: true })}
          onPlan={() => setPlanningRecipe(selectedRecipe)}
        />
      ) : null}

      {hydrated && selectedRecipe && route.cooking ? (
        <CookMode
          recipe={selectedRecipe}
          servings={selectedRecipe.servings}
          onClose={() => navigate({ cooking: false })}
          onFinish={() => {
            navigate({ cooking: false });
            setCookLogRecipe(selectedRecipe);
          }}
        />
      ) : null}

      {recipeForm ? (
        <RecipeForm
          initialValues={recipeForm}
          onClose={() => setRecipeForm(null)}
          onSaved={(recipeId) => {
            setRecipeForm(null);
            openRecipe(recipeId);
          }}
        />
      ) : null}

      {importOpen ? (
        <ImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(values) => {
            setImportOpen(false);
            setRecipeForm(values);
          }}
        />
      ) : null}

      {cookLogRecipe ? (
        <CookLogDialog
          recipe={cookLogRecipe}
          defaultServings={cookLogRecipe.servings}
          onClose={() => setCookLogRecipe(null)}
        />
      ) : null}

      {planningRecipe ? (
        <PlanRecipeDialog recipe={planningRecipe} onClose={() => setPlanningRecipe(null)} />
      ) : null}

      {dataDialogOpen ? <DataDialog onClose={() => setDataDialogOpen(false)} /> : null}
    </div>
  );
}

/** Rychlé naplánování konkrétního receptu z jeho detailu. */
function PlanRecipeDialog({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const { commit } = useAppState();
  const { showToast } = useToast();

  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [servings, setServings] = useState(recipe.servings ? `${recipe.servings}` : "");

  const handleSave = () => {
    const parsed = Number.parseInt(servings, 10);
    commit(
      (current) =>
        mutations.addMealPlanEntry(current, {
          date,
          slot,
          recipeId: recipe.id,
          servings: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        }),
      "Naplánování jídla",
    );
    showToast(`„${recipe.title}" naplánováno.`);
    onClose();
  };

  return (
    <Modal
      title="Naplánovat jídlo"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary-button" onClick={onClose}>
            Zrušit
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Naplánovat
          </button>
        </>
      }
    >
      <div className="content-stack compact">
        <p className="muted-copy">{recipe.title}</p>

        <label className="field-stack">
          <span>Datum</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field-stack">
          <span>Kdy</span>
          <select value={slot} onChange={(event) => setSlot(event.target.value as MealSlot)}>
            {MEAL_SLOTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>Počet porcí</span>
          <input
            inputMode="numeric"
            value={servings}
            placeholder="nepovinné"
            onChange={(event) => setServings(event.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
}
