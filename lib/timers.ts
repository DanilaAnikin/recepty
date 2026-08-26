/**
 * Vytahování časů z textu postupu — "vař 20 minut" se v režimu vaření
 * promění v tapnutelný časovač.
 *
 * Záměrně konzervativní: raději časovač nenabídnout, než nabídnout nesmysl.
 * Proto se berou jen čísla, po kterých následuje jednotka času, a ignorují se
 * teploty ("180 °C"), velikosti ("20 cm") i množství ("20 g").
 */

export type DetectedDuration = {
  /** Délka v sekundách. */
  seconds: number;
  /** Přesný úsek původního textu, ze kterého to vzniklo ("20 minut"). */
  text: string;
  /** Pozice v textu — kvůli zvýraznění. */
  start: number;
  end: number;
};

const UNIT_SECONDS: Array<{ pattern: string; seconds: number }> = [
  { pattern: "hodin[a-yá-ž]*", seconds: 3600 },
  { pattern: "hod\\.?", seconds: 3600 },
  { pattern: "h", seconds: 3600 },
  { pattern: "minut[a-yá-ž]*", seconds: 60 },
  { pattern: "min\\.?", seconds: 60 },
  { pattern: "vteřin[a-yá-ž]*", seconds: 1 },
  { pattern: "sekund[a-yá-ž]*", seconds: 1 },
  { pattern: "s", seconds: 1 },
];

// Číslo (i rozsah "20-25" nebo desetinné "1,5"), mezera, jednotka času.
const DURATION_PATTERN = new RegExp(
  `(\\d+(?:[.,]\\d+)?)(?:\\s*[-–]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${UNIT_SECONDS.map((item) => item.pattern).join("|")})\\b`,
  "giu",
);

function unitToSeconds(unitText: string): number | null {
  const normalized = unitText.toLowerCase();
  for (const entry of UNIT_SECONDS) {
    if (new RegExp(`^(?:${entry.pattern})$`, "iu").test(normalized)) {
      return entry.seconds;
    }
  }
  return null;
}

/**
 * Najde v textu všechny časové údaje.
 * U rozsahu ("20-25 minut") se bere horní mez — časovač, který zazvoní pozdě,
 * je při vaření lepší než ten, co zazvoní brzy a člověk na jídlo zapomene.
 */
export function detectDurations(text: string): DetectedDuration[] {
  const results: DetectedDuration[] = [];
  DURATION_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DURATION_PATTERN.exec(text)) !== null) {
    const [full, lowerRaw, upperRaw, unitText] = match;
    const unitSeconds = unitToSeconds(unitText);
    if (unitSeconds === null) {
      continue;
    }

    const chosenRaw = upperRaw ?? lowerRaw;
    const value = Number.parseFloat(chosenRaw.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    const seconds = Math.round(value * unitSeconds);
    // Nesmyslně krátké i absurdně dlouhé údaje přeskoč — bývá to překlep
    // nebo něco, co vůbec není čas.
    if (seconds < 10 || seconds > 24 * 3600) {
      continue;
    }

    results.push({
      seconds,
      text: full.trim(),
      start: match.index,
      end: match.index + full.length,
    });
  }

  return results;
}

/** První (a v praxi obvykle jediný) časovač v kroku postupu. */
export function primaryDuration(text: string): DetectedDuration | null {
  return detectDurations(text)[0] ?? null;
}

/** "07:30" nebo "1:05:00" — formát odpočtu. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => `${value}`.padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Lidský popis délky pro tlačítko ("20 min", "1 h 30 min"). */
export function formatDurationLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} h`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  return `${safe} s`;
}
