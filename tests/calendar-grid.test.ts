import { describe, expect, it } from "vitest";

import { dayLabel, monthGrid, monthLabel, monthOf, monthsBetween } from "@/lib/calendar-grid";

describe("monthGrid", () => {
  it("lays November 2026 out in full weeks starting on Sunday", () => {
    const weeks = monthGrid("2026-11");
    // Nov 1 2026 is a Sunday; Nov 30 is a Monday
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ key: "2026-11-01", dayOfMonth: 1, inMonth: true });
    expect(weeks[4][1]).toEqual({ key: "2026-11-30", dayOfMonth: 30, inMonth: true });
    expect(weeks[4][2]).toEqual({ key: "2026-12-01", dayOfMonth: 1, inMonth: false });
  });

  it("pads the start of a month that begins midweek", () => {
    const weeks = monthGrid("2026-12"); // Dec 1 2026 is a Tuesday
    expect(weeks[0].map((d) => d.inMonth)).toEqual([false, false, true, true, true, true, true]);
    expect(weeks[0][0].key).toBe("2026-11-29");
  });

  it("contains every day of the month exactly once", () => {
    for (const [month, days] of [["2026-11", 30], ["2026-12", 31], ["2027-02", 28], ["2028-02", 29]] as const) {
      const inMonth = monthGrid(month).flat().filter((d) => d.inMonth);
      expect(inMonth).toHaveLength(days);
      expect(new Set(inMonth.map((d) => d.key)).size).toBe(days);
      expect(inMonth.every((d) => d.key.startsWith(month))).toBe(true);
    }
  });

  it("handles a month needing six rows and a year boundary", () => {
    const weeks = monthGrid("2027-01"); // Jan 1 2027 is a Friday
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].key).toBe("2026-12-27");
    expect(weeks[5][6].key).toBe("2027-02-06");
  });
});

describe("monthsBetween", () => {
  it("lists months inclusive, across a year end", () => {
    expect(monthsBetween("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(monthsBetween("2026-11", "2026-11")).toEqual(["2026-11"]);
    expect(monthsBetween("2027-01", "2026-11")).toEqual([]);
  });
});

describe("labels", () => {
  it("names months and days without shifting by timezone", () => {
    expect(monthOf("2026-11-16")).toBe("2026-11");
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(dayLabel("2026-11-16")).toBe("Monday, November 16");
    expect(dayLabel("2027-01-01")).toBe("Friday, January 1");
  });
});
