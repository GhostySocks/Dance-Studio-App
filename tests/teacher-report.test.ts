import { describe, expect, it } from "vitest";

import { payOwedCents, summarizeTaught, type TaughtClass } from "@/lib/teacher-report";

function taught(className: string, minutes: number, attended: number | null = 5): TaughtClass {
  return {
    sessionId: `${className}-${minutes}-${Math.random()}`,
    className,
    roomName: "Studio A",
    startTime: "2026-11-02T17:00:00.000Z",
    endTime: "2026-11-02T18:00:00.000Z",
    minutes,
    enrolled: 8,
    attended,
  };
}

describe("summarizeTaught", () => {
  it("totals classes and time, and groups by class", () => {
    const totals = summarizeTaught([
      taught("Jazz", 60),
      taught("Ballet", 45),
      taught("Jazz", 60),
      taught("Ballet", 45, null),
      taught("Hip Hop", 90),
    ]);
    expect(totals.classes).toBe(5);
    expect(totals.minutes).toBe(300);
    expect(totals.hours).toBe(5);
    expect(totals.attendanceMissing).toBe(1);
    expect(totals.byClass).toEqual([
      { className: "Ballet", classes: 2, minutes: 90 },
      { className: "Hip Hop", classes: 1, minutes: 90 },
      { className: "Jazz", classes: 2, minutes: 120 },
    ]);
  });

  it("rounds hours to two decimals", () => {
    expect(summarizeTaught([taught("Tiny Dancers", 45), taught("Tiny Dancers", 35)]).hours).toBe(1.33);
  });

  it("handles a period with no classes", () => {
    expect(summarizeTaught([])).toMatchObject({ classes: 0, minutes: 0, hours: 0, byClass: [] });
  });
});

describe("payOwedCents", () => {
  const totals = { classes: 9, minutes: 615 }; // 10.25 hours

  it("pays per class", () => {
    expect(payOwedCents(totals, "PER_CLASS", 4000)).toBe(36000);
  });

  it("pays per hour for the exact time taught, in whole cents", () => {
    expect(payOwedCents(totals, "PER_HOUR", 3500)).toBe(35875);
    expect(payOwedCents({ classes: 1, minutes: 50 }, "PER_HOUR", 3333)).toBe(2778);
  });

  it("is zero without a usable rate", () => {
    expect(payOwedCents(totals, "PER_CLASS", 0)).toBe(0);
    expect(payOwedCents(totals, "PER_HOUR", -5)).toBe(0);
    expect(payOwedCents(totals, "PER_HOUR", Number.NaN)).toBe(0);
  });
});
