import { describe, expect, it } from "vitest";

import { chargesToBill, monthKey, planCharges, weekKey } from "@/lib/registration-billing";

const NY = "America/New_York";
const at = (iso: string) => new Date(iso);

// Mondays 4pm New York, Nov 9 through Dec 7 2026 (EST = UTC-5)
const mondays = ["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"].map((d) =>
  at(`${d}T21:00:00Z`)
);
const base = {
  priceCents: 2200,
  coverageName: "Fall 2026",
  registeredAt: at("2026-11-02T15:00:00Z"),
  sessionStarts: mondays,
  timeZone: NY,
};

describe("weekKey / monthKey", () => {
  it("uses the studio's local calendar, not UTC", () => {
    // Sunday 11pm New York is already Monday in UTC
    expect(weekKey(at("2026-11-09T04:00:00Z"), NY)).toBe("2026-11-02");
    expect(weekKey(at("2026-11-09T05:00:00Z"), NY)).toBe("2026-11-09");
    // Oct 31 11pm New York (EDT) is Nov 1 in UTC
    expect(monthKey(at("2026-11-01T03:00:00Z"), NY)).toBe("2026-10");
  });

  it("puts every day of a week under its Monday", () => {
    for (const day of ["09", "10", "11", "12", "13", "14", "15"]) {
      expect(weekKey(at(`2026-11-${day}T17:00:00Z`), NY)).toBe("2026-11-09");
    }
    expect(weekKey(at("2026-11-16T17:00:00Z"), NY)).toBe("2026-11-16");
  });
});

describe("planCharges", () => {
  it("charges a semester once, owed from registration", () => {
    expect(planCharges({ ...base, plan: "SEMESTER", priceCents: 32000 })).toEqual([
      { key: "full", label: "Fall 2026", dueDate: base.registeredAt, amountCents: 32000 },
    ]);
  });

  it("charges an annual plan once", () => {
    const charges = planCharges({ ...base, plan: "ANNUAL", priceCents: 90000, coverageName: "2026–27" });
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ key: "full", label: "2026–27", amountCents: 90000 });
  });

  it("charges weekly once per week that has a class", () => {
    const charges = planCharges({ ...base, plan: "WEEKLY" });
    expect(charges.map((c) => c.key)).toEqual([
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
    ]);
    expect(charges[0]).toEqual({
      key: "2026-11-09",
      label: "week of Nov 9",
      dueDate: mondays[0],
      amountCents: 2200,
    });
  });

  it("charges a week once even with two classes in it, and skips weeks with none", () => {
    const sessionStarts = [
      at("2026-11-09T21:00:00Z"),
      at("2026-11-11T21:00:00Z"), // same week
      at("2026-11-30T21:00:00Z"), // two weeks skipped (holiday)
    ];
    const charges = planCharges({ ...base, plan: "WEEKLY", sessionStarts });
    expect(charges.map((c) => c.key)).toEqual(["2026-11-09", "2026-11-30"]);
    expect(charges[0].dueDate).toEqual(sessionStarts[0]);
  });

  it("charges monthly once per month that has a class", () => {
    const charges = planCharges({ ...base, plan: "MONTHLY", priceCents: 8500 });
    expect(charges).toEqual([
      { key: "2026-11", label: "November 2026", dueDate: mondays[0], amountCents: 8500 },
      { key: "2026-12", label: "December 2026", dueDate: mondays[4], amountCents: 8500 },
    ]);
  });

  it("owes nothing when the student holds no dates", () => {
    for (const plan of ["WEEKLY", "MONTHLY", "SEMESTER", "ANNUAL"] as const) {
      expect(planCharges({ ...base, plan, sessionStarts: [] })).toEqual([]);
    }
  });

  it("is not used for per-class enrollments", () => {
    expect(planCharges({ ...base, plan: "PER_CLASS" })).toEqual([]);
  });

  it("does not depend on the order of the dates", () => {
    const shuffled = [mondays[3], mondays[0], mondays[4], mondays[1], mondays[2]];
    expect(planCharges({ ...base, plan: "WEEKLY", sessionStarts: shuffled })).toEqual(
      planCharges({ ...base, plan: "WEEKLY" })
    );
  });
});

describe("chargesToBill", () => {
  const weekly = planCharges({ ...base, plan: "WEEKLY" });

  it("bills what is owed by the end of the period", () => {
    const november = chargesToBill(weekly, at("2026-12-01T04:59:59Z"), []);
    expect(november.map((c) => c.key)).toEqual(["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  });

  it("never bills the same instalment twice", () => {
    const december = chargesToBill(weekly, at("2027-01-01T04:59:59Z"), [
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
    expect(december.map((c) => c.key)).toEqual(["2026-12-07"]);
  });

  it("catches up instalments a previous invoice run missed", () => {
    const late = chargesToBill(weekly, at("2027-01-01T04:59:59Z"), ["2026-11-09"]);
    expect(late).toHaveLength(4);
  });

  it("bills a semester only once it has been registered", () => {
    const semester = planCharges({ ...base, plan: "SEMESTER", priceCents: 32000 });
    expect(chargesToBill(semester, at("2026-11-01T00:00:00Z"), [])).toEqual([]);
    expect(chargesToBill(semester, at("2026-11-30T00:00:00Z"), [])).toHaveLength(1);
    expect(chargesToBill(semester, at("2026-12-31T00:00:00Z"), ["full"])).toEqual([]);
  });
});
