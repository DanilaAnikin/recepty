import { MEAL_SLOTS, type MealPlanEntry, type MealSlot, type Recipe } from "./domain";

/**
 * Týdenní plánovač jídel.
 *
 * Datum se všude drží jako `YYYY-MM-DD` v *lokálním* čase, ne jako ISO timestamp.
 * Kdyby se používalo `toISOString()`, uživatel v UTC+2 by po 22:00 plánoval
 * omylem na další den — proto vlastní `toDateKey` místo `Date.prototype.toISOString`.
 */

export type PlannerDay = {
  date: string;
  /** 0 = pondělí … 6 = neděle. */
  weekdayIndex: number;
  isToday: boolean;
  entries: MealPlanEntry[];
};

const WEEKDAY_LABELS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const WEEKDAY_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date(Number.NaN);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Pondělí týdne, do kterého datum spadá. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  // getDay(): 0 = neděle. Přepočet na pondělí jako první den týdne.
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

export function weekdayLabel(dateKey: string): string {
  const date = fromDateKey(dateKey);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return WEEKDAY_LABELS[(date.getDay() + 6) % 7];
}

export function weekdayShortLabel(dateKey: string): string {
  const date = fromDateKey(dateKey);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return WEEKDAY_SHORT[(date.getDay() + 6) % 7];
}

/** "3. 9." — krátký lidský zápis dne bez roku. */
export function shortDateLabel(dateKey: string): string {
  const date = fromDateKey(dateKey);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  return `${date.getDate()}. ${date.getMonth() + 1}.`;
}

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOTS.find((item) => item.value === slot)?.label ?? slot;
}

/** Sedm dní týdne s přiřazenými záznamy plánu. */
export function buildWeek(weekStart: Date, mealPlan: MealPlanEntry[], now = new Date()): PlannerDay[] {
  const todayKey = toDateKey(now);
  const byDate = new Map<string, MealPlanEntry[]>();
  for (const entry of mealPlan) {
    const bucket = byDate.get(entry.date);
    if (bucket) {
      bucket.push(entry);
    } else {
      byDate.set(entry.date, [entry]);
    }
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = toDateKey(date);
    const entries = (byDate.get(key) ?? []).slice().sort((left, right) => {
      return slotOrder(left.slot) - slotOrder(right.slot);
    });
    return { date: key, weekdayIndex: index, isToday: key === todayKey, entries };
  });
}

function slotOrder(slot: MealSlot): number {
  const index = MEAL_SLOTS.findIndex((item) => item.value === slot);
  return index === -1 ? MEAL_SLOTS.length : index;
}

/**
 * Recepty naplánované v rozsahu dní, i s počtem porcí — přímý vstup pro
 * `buildShoppingItems`. Stejný recept naplánovaný dvakrát se objeví dvakrát,
 * takže se množství správně sečte.
 */
export function plannedRecipesInRange(
  mealPlan: MealPlanEntry[],
  recipes: Recipe[],
  fromDateKeyInclusive: string,
  toDateKeyInclusive: string,
): Array<{ recipe: Recipe; servings?: number }> {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return mealPlan
    .filter((entry) => entry.date >= fromDateKeyInclusive && entry.date <= toDateKeyInclusive)
    .map((entry) => {
      if (entry.recipeId === null) {
        return null;
      }
      const recipe = byId.get(entry.recipeId);
      if (!recipe) {
        return null;
      }
      return { recipe, servings: entry.servings };
    })
    .filter((item): item is { recipe: Recipe; servings?: number } => item !== null);
}

/** Kolik jídel je v týdnu naplánovaných — pro souhrn v hlavičce. */
export function countPlannedMeals(days: PlannerDay[]): number {
  return days.reduce((sum, day) => sum + day.entries.length, 0);
}
