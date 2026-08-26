import { describe, expect, it } from "vitest";

import { detectDurations, formatCountdown, formatDurationLabel, primaryDuration } from "./timers";

describe("detectDurations", () => {
  it("finds minutes written out in Czech", () => {
    const found = detectDurations("Vař 20 minut doměkka.");
    expect(found).toHaveLength(1);
    expect(found[0].seconds).toBe(20 * 60);
  });

  it("handles the abbreviated form", () => {
    expect(detectDurations("Peč 45 min.")[0].seconds).toBe(45 * 60);
  });

  it("handles hours", () => {
    expect(detectDurations("Nech 2 hodiny odpočívat.")[0].seconds).toBe(2 * 3600);
  });

  it("takes the upper bound of a range so nothing burns unnoticed", () => {
    expect(detectDurations("Peč 20-25 minut")[0].seconds).toBe(25 * 60);
  });

  it("handles an en dash range", () => {
    expect(detectDurations("Peč 20–25 minut")[0].seconds).toBe(25 * 60);
  });

  it("handles a decimal amount", () => {
    expect(detectDurations("Nech 1,5 hodiny kynout")[0].seconds).toBe(90 * 60);
  });

  it("finds several durations in one step", () => {
    const found = detectDurations("Restuj 5 minut, pak duste 30 minut.");
    expect(found.map((item) => item.seconds)).toEqual([5 * 60, 30 * 60]);
  });

  it("ignores oven temperatures", () => {
    expect(detectDurations("Rozehřej troubu na 180 °C.")).toEqual([]);
  });

  it("ignores quantities", () => {
    expect(detectDurations("Přidej 200 g mouky.")).toEqual([]);
  });

  it("ignores sizes in centimetres", () => {
    expect(detectDurations("Nakrájej na kostky 2 cm.")).toEqual([]);
  });

  it("ignores absurdly long durations", () => {
    expect(detectDurations("Nech 50 hodin")).toEqual([]);
  });

  it("ignores durations shorter than ten seconds", () => {
    expect(detectDurations("Zamíchej 5 s")).toEqual([]);
  });

  it("reports the matched text and its position", () => {
    const found = detectDurations("Vař 20 minut.");
    expect(found[0].text).toBe("20 minut");
    expect("Vař 20 minut.".slice(found[0].start, found[0].end)).toBe("20 minut");
  });

  it("returns nothing for text without a duration", () => {
    expect(detectDurations("Osol a opepři.")).toEqual([]);
  });
});

describe("primaryDuration", () => {
  it("returns the first duration found", () => {
    expect(primaryDuration("Restuj 5 minut, pak duste 30 minut.")?.seconds).toBe(5 * 60);
  });

  it("returns null when there is none", () => {
    expect(primaryDuration("Osol a opepři.")).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats under an hour as mm:ss", () => {
    expect(formatCountdown(90)).toBe("01:30");
  });

  it("pads single digits", () => {
    expect(formatCountdown(5)).toBe("00:05");
  });

  it("formats an hour or more as h:mm:ss", () => {
    expect(formatCountdown(3661)).toBe("1:01:01");
  });

  it("never goes negative", () => {
    expect(formatCountdown(-10)).toBe("00:00");
  });
});

describe("formatDurationLabel", () => {
  it("shows whole minutes", () => {
    expect(formatDurationLabel(20 * 60)).toBe("20 min");
  });

  it("shows hours and minutes together", () => {
    expect(formatDurationLabel(90 * 60)).toBe("1 h 30 min");
  });

  it("shows whole hours on their own", () => {
    expect(formatDurationLabel(2 * 3600)).toBe("2 h");
  });

  it("falls back to seconds for very short spans", () => {
    expect(formatDurationLabel(20)).toBe("20 s");
  });
});
