/**
 * Verze datového schématu. Zvyš při každé nekompatibilní změně tvaru `AppState`
 * a doplň migraci do `MIGRATIONS` níž. Uložená data si verzi nesou s sebou,
 * takže starší záloha jde vždycky dohrát.
 *
 * Žije tady (a ne v `domain.ts`), aby závislost mezi moduly vedla jen jedním
 * směrem: domain -> migrations.
 */
export const SCHEMA_VERSION = 2;

/**
 * Migrace uloženého stavu mezi verzemi schématu.
 *
 * Pravidla:
 * - Každá migrace bere *neověřený* objekt a vrací *neověřený* objekt. Validace
 *   a doplnění výchozích hodnot dělá až `normalizeState` v `domain.ts` — díky
 *   tomu tady řešíme jen přejmenování a přepočty tvaru, ne typovou obranu.
 * - Migrace musí být idempotentní vůči už zmigrovaným datům (kontrolují, jestli
 *   cílové pole už neexistuje), aby dvojité spuštění nic nerozbilo.
 * - Data bez `schemaVersion` se považují za verzi 1 (původní localStorage tvar).
 */

export type UnknownState = Record<string, unknown>;

type Migration = {
  /** Verze, ze které se migruje. Výsledkem je `from + 1`. */
  from: number;
  migrate: (state: UnknownState) => UnknownState;
};

const MIGRATIONS: Migration[] = [
  {
    // v1 -> v2: `pantrySelection: number[]` (mám/nemám) se rozšiřuje na
    // `pantry: PantryItem[]`, které navíc unese množství a datum spotřeby.
    // Zároveň přibývají prázdné kolekce pro plánovač a nákupní seznam.
    from: 1,
    migrate: (state) => {
      const legacySelection = Array.isArray(state.pantrySelection)
        ? state.pantrySelection.filter((value): value is number => typeof value === "number")
        : [];
      const now = new Date().toISOString();
      const next: UnknownState = { ...state };

      if (!Array.isArray(next.pantry)) {
        next.pantry = legacySelection.map((ingredientId) => ({
          ingredientId,
          updatedAt: now,
        }));
      }
      delete next.pantrySelection;

      if (!Array.isArray(next.mealPlan)) {
        next.mealPlan = [];
      }
      if (!Array.isArray(next.shoppingList)) {
        next.shoppingList = [];
      }
      return next;
    },
  },
];

/** Verze schématu uložených dat. Chybějící `schemaVersion` znamená v1. */
export function detectSchemaVersion(state: UnknownState): number {
  const raw = state.schemaVersion;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  return 1;
}

/**
 * Postupně provede všechny migrace od verze dat po `SCHEMA_VERSION`.
 * Data novější než tahle build (vyšší `schemaVersion`) se nechají být — projdou
 * validací v `normalizeState`, která neznámá pole zahodí. Je to lepší než odmítnout
 * načtení, protože uživatel může mít appku otevřenou ve dvou různě starých tabech.
 */
export function migrateState(state: UnknownState): UnknownState {
  let current = state;
  let version = detectSchemaVersion(current);

  while (version < SCHEMA_VERSION) {
    const migration = MIGRATIONS.find((candidate) => candidate.from === version);
    if (!migration) {
      // Chybějící krok v řetězci by znamenal nekonečnou smyčku — radši
      // skočíme na cílovou verzi a necháme validaci doplnit výchozí hodnoty.
      break;
    }
    current = migration.migrate(current);
    version += 1;
  }

  return { ...current, schemaVersion: Math.max(version, SCHEMA_VERSION) };
}
