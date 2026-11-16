import { describe, expect, it } from "vitest";

import { addDays, closedDays, closureLength, closureRangeLabel } from "@/lib/closures";
import { closureSchema } from "@/lib/validations/closure";

describe("closure days", () => {
  it("steps across month and year ends", () => {
    expect(addDays("2026-12-31")).toBe("2027-01-01");
    expect(addDays("2028-02-28")).toBe("2028-02-29");
    expect(addDays("2026-12-24", 8)).toBe("2027-01-01");
  });

  it("counts both ends", () => {
    expect(closureLength({ startDay: "2026-12-25", endDay: "2026-12-25" })).toBe(1);
    expect(closureLength({ startDay: "2026-12-24", endDay: "2027-01-01" })).toBe(9);
  });

  it("lists every closed day with the closure's name", () => {
    const days = closedDays([
      { name: "Christmas break", startDay: "2026-12-24", endDay: "2026-12-26" },
      { name: "Thanksgiving", startDay: "2026-11-26", endDay: "2026-11-26" },
    ]);
    expect(Array.from(days.keys()).sort()).toEqual(["2026-11-26", "2026-12-24", "2026-12-25", "2026-12-26"]);
    expect(days.get("2026-12-25")).toBe("Christmas break");
    expect(days.has("2026-12-27")).toBe(false);
  });

  it("names an overlapping day after the closure that starts first", () => {
    const days = closedDays([
      { name: "Staff day", startDay: "2026-12-26", endDay: "2026-12-26" },
      { name: "Christmas break", startDay: "2026-12-24", endDay: "2026-12-28" },
    ]);
    expect(days.get("2026-12-26")).toBe("Christmas break");
  });

  it("ignores a record whose end is before its start", () => {
    expect(closedDays([{ name: "Bad", startDay: "2026-12-26", endDay: "2026-12-20" }]).size).toBe(0);
  });

  it("labels one day and a range", () => {
    expect(closureRangeLabel({ startDay: "2026-11-26", endDay: "2026-11-26" })).toBe("Nov 26, 2026");
    expect(closureRangeLabel({ startDay: "2026-12-24", endDay: "2027-01-01" })).toBe("Dec 24 – Jan 1, 2027");
  });
});

describe("closureSchema", () => {
  const ok = (input: unknown) => closureSchema.safeParse(input).success;

  it("accepts a single day and a range", () => {
    expect(ok({ name: "Thanksgiving", startDay: "2026-11-26", endDay: "2026-11-26" })).toBe(true);
    expect(ok({ name: "Christmas break", startDay: "2026-12-24", endDay: "2027-01-01" })).toBe(true);
  });

  it("rejects a missing name, a backwards range, bad dates and very long closures", () => {
    expect(ok({ name: " ", startDay: "2026-11-26", endDay: "2026-11-26" })).toBe(false);
    expect(ok({ name: "X", startDay: "2026-12-26", endDay: "2026-12-24" })).toBe(false);
    expect(ok({ name: "X", startDay: "12/24/2026", endDay: "2026-12-26" })).toBe(false);
    expect(ok({ name: "X", startDay: "2026-01-01", endDay: "2026-12-31" })).toBe(false);
  });
});
