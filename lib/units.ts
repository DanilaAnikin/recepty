import { INGREDIENT_UNITS, type IngredientUnit } from "./domain";

/**
 * Převody jednotek pro slučování množství (nákupní seznam, spíž).
 *
 * Lžíce a lžičky patří do objemové rodiny (5 / 15 ml), takže "2 lžíce oleje"
 * a "50 ml oleje" jde sečíst. Zobrazovací jednotka se přitom volí podle toho,
 * která ve vstupech převažuje — 1 lžička + 2 lžičky proto zůstane "3 lžičky"
 * a nezvrhne se v "15 ml".
 */

export type UnitFamily = "mass" | "volume" | "count";

type UnitMeta = {
  family: UnitFamily;
  /** Kolik základních jednotek rodiny (g / ml / ks) je v jedné téhle jednotce. */
  factor: number;
};

const UNIT_META: Record<IngredientUnit, UnitMeta> = {
  g: { family: "mass", factor: 1 },
  kg: { family: "mass", factor: 1000 },
  ml: { family: "volume", factor: 1 },
  l: { family: "volume", factor: 1000 },
  ks: { family: "count", factor: 1 },
  par: { family: "count", factor: 2 },
  lzicka: { family: "volume", factor: 5 },
  lzice: { family: "volume", factor: 15 },
};

/** Jednotky rodiny od nejmenší po největší — pro volbu čitelnějšího zobrazení. */
const FAMILY_LADDER: Record<UnitFamily, IngredientUnit[]> = {
  mass: ["g", "kg"],
  volume: ["ml", "l"],
  count: ["ks"],
};

export function unitFamily(unit: IngredientUnit): UnitFamily {
  return UNIT_META[unit].family;
}

export function toBaseAmount(value: number, unit: IngredientUnit): number {
  return value * UNIT_META[unit].factor;
}

export function fromBaseAmount(base: number, unit: IngredientUnit): number {
  return base / UNIT_META[unit].factor;
}

export function areUnitsCompatible(left: IngredientUnit, right: IngredientUnit): boolean {
  return unitFamily(left) === unitFamily(right);
}

export type ParsedAmount = {
  /** Hodnota použitá pro výpočty. U rozsahu je to horní mez — ať se toho koupí dost. */
  value: number;
  /** Původní text měl podobu rozsahu ("2-3"). */
  isRange: boolean;
  /** Text obsahoval čárku jako desetinný oddělovač. */
  usesComma: boolean;
};

/**
 * Vytáhne z textu množství číselnou hodnotu. Zvládne celá čísla, desetinná
 * s tečkou i čárkou, zlomky ("1/2") a rozsahy ("2-3", "2–3").
 * Popisná množství ("špetka", "dle chuti") vrací `null` — ta se nesčítají.
 */
export function parseAmount(amountText: string): ParsedAmount | null {
  const trimmed = amountText.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parseNumber = (raw: string): number | null => {
    const normalized = raw.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      return null;
    }
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  };

  const rangeMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/);
  if (rangeMatch) {
    const upper = parseNumber(rangeMatch[2]);
    if (upper === null) {
      return null;
    }
    return { value: upper, isRange: true, usesComma: trimmed.includes(",") };
  }

  const fractionMatch = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (fractionMatch) {
    const numerator = parseNumber(fractionMatch[1]);
    const denominator = parseNumber(fractionMatch[2]);
    if (numerator === null || denominator === null || denominator === 0) {
      return null;
    }
    return { value: numerator / denominator, isRange: false, usesComma: trimmed.includes(",") };
  }

  const single = parseNumber(trimmed);
  if (single === null) {
    return null;
  }
  return { value: single, isRange: false, usesComma: trimmed.includes(",") };
}

/** Zformátuje číslo na max 2 desetinná místa, bez zbytečných nul. */
export function formatAmountNumber(value: number, usesComma = false): string {
  const rounded = Math.round(value * 100) / 100;
  let text = rounded.toFixed(2).replace(/\.?0+$/, "");
  if (text.length === 0) {
    text = "0";
  }
  return usesComma ? text.replace(".", ",") : text;
}

export type MergedAmount = {
  value: number;
  unit: IngredientUnit;
  text: string;
};

/**
 * Sečte množství se stejnou rodinou jednotek a vybere čitelnou zobrazovací jednotku.
 *
 * Zobrazovací jednotka = ta ze vstupů, která přispěla největší částí celku
 * (takže lžičky zůstanou lžičkami). Pokud by výsledek v ní byl nepohodlný
 * (< 1, nebo >= 1000 základních jednotek), přeskočí se na vhodnější stupeň
 * žebříčku rodiny — 1500 g se ukáže jako 1,5 kg, 0,5 kg jako 500 g.
 */
export function mergeAmounts(
  parts: Array<{ value: number; unit: IngredientUnit }>,
): MergedAmount | null {
  if (parts.length === 0) {
    return null;
  }

  const family = unitFamily(parts[0].unit);
  if (parts.some((part) => unitFamily(part.unit) !== family)) {
    return null;
  }

  const totalBase = parts.reduce((sum, part) => sum + toBaseAmount(part.value, part.unit), 0);

  // Jednotka s největším příspěvkem do součtu vyhrává jako výchozí zobrazení.
  const contributions = new Map<IngredientUnit, number>();
  for (const part of parts) {
    const base = toBaseAmount(part.value, part.unit);
    contributions.set(part.unit, (contributions.get(part.unit) ?? 0) + base);
  }
  let displayUnit = parts[0].unit;
  let best = -1;
  for (const [unit, contribution] of contributions) {
    if (contribution > best) {
      best = contribution;
      displayUnit = unit;
    }
  }

  // Zlepši čitelnost jen pro "obyčejné" jednotky rodiny; lžíce/lžičky/pár
  // necháváme být, protože u nich je zachování původní jednotky cennější.
  const ladder = FAMILY_LADDER[family];
  if (ladder.includes(displayUnit)) {
    for (let index = ladder.length - 1; index >= 0; index -= 1) {
      const candidate = ladder[index];
      const inCandidate = fromBaseAmount(totalBase, candidate);
      if (inCandidate >= 1) {
        displayUnit = candidate;
        break;
      }
      displayUnit = ladder[0];
    }
  }

  const value = fromBaseAmount(totalBase, displayUnit);
  return {
    value,
    unit: displayUnit,
    text: formatAmountNumber(value),
  };
}

export function unitLabel(unit: IngredientUnit): string {
  return INGREDIENT_UNITS.find((item) => item.value === unit)?.label ?? unit;
}
