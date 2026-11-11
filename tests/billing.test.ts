import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  enrollment: { findMany: vi.fn() },
  pricingRule: { findMany: vi.fn() },
  scholarship: { findMany: vi.fn() },
  registration: { findMany: vi.fn() },
  studioProfile: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { generateFamilyInvoice, generateStudentInvoice } from "@/lib/billing";

const period = {
  periodStart: new Date("2026-11-01T00:00:00Z"),
  periodEnd: new Date("2026-11-30T23:59:59Z"),
};

function enrollment(name: string, basePriceCents: number, student = "Emma Thompson") {
  const [firstName, lastName] = student.split(" ");
  return {
    id: `enr-${name}`,
    studentId: `stu-${firstName}`,
    student: { firstName, lastName },
    session: { id: `ses-${name}`, template: { name, danceStyle: null, basePriceCents } },
  };
}

function rule(discountType: string, discountValue: number, triggerCount = 2) {
  return { id: `rule-${discountType}`, name: discountType, triggerCount, discountType, discountValue };
}

function scholarship(type: string, value: number, name = "Award") {
  return { id: `sch-${type}`, name, type, value };
}

/** A term registration as the billing query returns it. Dates are Mondays 4pm New York. */
function registration(
  className: string,
  plan: string,
  priceCents: number,
  {
    student = "Emma Thompson",
    days = ["2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"],
    billed = [] as string[],
    createdAt = "2026-11-02T15:00:00Z",
  } = {}
) {
  const [firstName, lastName] = student.split(" ");
  return {
    id: `reg-${className}-${firstName}`,
    plan,
    priceCents,
    createdAt: new Date(createdAt),
    studentId: `stu-${firstName}`,
    student: { firstName, lastName },
    template: { name: className },
    term: { name: "Fall 2026" },
    season: null,
    enrollments: days.map((d) => ({ session: { startTime: new Date(`${d}T21:00:00Z`) } })),
    charges: billed.map((periodKey) => ({ periodKey })),
  };
}

function setup({
  enrollments = [] as ReturnType<typeof enrollment>[],
  rules = [] as ReturnType<typeof rule>[],
  scholarships = [] as ReturnType<typeof scholarship>[],
  registrations = [] as ReturnType<typeof registration>[],
}) {
  db.registration.findMany.mockResolvedValue(registrations);
  db.studioProfile.findFirst.mockResolvedValue({ timezone: "America/New_York" });
  db.enrollment.findMany.mockResolvedValue(enrollments);
  db.pricingRule.findMany.mockResolvedValue(rules);
  db.scholarship.findMany.mockResolvedValue(scholarships);
}

const family = (overrides = {}) =>
  generateFamilyInvoice({ familyGroupId: "fam-1", ...period, ...overrides });

function sum(lineItems: { amountCents: number }[]) {
  return lineItems.reduce((total, item) => total + item.amountCents, 0);
}

describe("generateFamilyInvoice", () => {
  beforeEach(() => setup({}));

  it("returns an empty invoice when the family has no active enrollments", async () => {
    expect(await family()).toEqual({
      lineItems: [],
      totalCents: 0,
      enrollmentCount: 0,
      registrationCharges: [],
    });
  });

  it("only bills ACTIVE enrollments inside the billing period", async () => {
    await family();
    const where = db.enrollment.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
    // Dates booked through a term registration are billed by plan instead
    expect(where.registrationId).toBeNull();
    expect(where.student).toEqual({ familyGroupId: "fam-1" });
    expect(where.session.startTime).toEqual({ gte: period.periodStart });
    expect(where.session.endTime).toEqual({ lte: period.periodEnd });
  });

  it("charges full price for a single enrollment", async () => {
    setup({ enrollments: [enrollment("Ballet", 3000)], rules: [rule("PERCENT_OFF", 50)] });
    const invoice = await family();
    expect(invoice.totalCents).toBe(3000);
    expect(invoice.lineItems).toEqual([
      { description: "Ballet — Emma Thompson", amountCents: 3000, type: "TUITION" },
    ]);
  });

  it("charges full price for every enrollment when there are no pricing rules", async () => {
    setup({ enrollments: [enrollment("Ballet", 3000), enrollment("Jazz", 2800)] });
    const invoice = await family();
    expect(invoice.totalCents).toBe(5800);
    expect(invoice.lineItems.every((item) => item.type === "TUITION")).toBe(true);
  });

  it("gives the discount to the cheaper classes: most expensive is billed in full", async () => {
    setup({
      // Deliberately out of order
      enrollments: [enrollment("Tiny Dancers", 2000), enrollment("Contemporary", 3500)],
      rules: [rule("PERCENT_OFF", 50)],
    });
    const invoice = await family();
    expect(invoice.lineItems).toEqual([
      { description: "Contemporary — Emma Thompson", amountCents: 3500, type: "TUITION" },
      { description: "Tiny Dancers — Emma Thompson", amountCents: 2000, type: "TUITION" },
      {
        description: "Multi-class discount — Tiny Dancers — Emma Thompson",
        amountCents: -1000,
        type: "DISCOUNT",
      },
    ]);
    expect(invoice.totalCents).toBe(4500);
  });

  it("applies a PERCENT_OFF rule only from its trigger count onward", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 3000), enrollment("C", 2000)],
      rules: [rule("PERCENT_OFF", 50, 3)],
    });
    const invoice = await family();
    // A full, B full (2nd, below the trigger), C half
    expect(invoice.totalCents).toBe(4000 + 3000 + 1000);
  });

  it("rounds percentage discounts to whole cents", async () => {
    setup({
      enrollments: [enrollment("A", 3000), enrollment("B", 2999)],
      rules: [rule("PERCENT_OFF", 33)],
    });
    const invoice = await family();
    // 2999 * 0.67 = 2009.33 -> 2009
    expect(invoice.totalCents).toBe(3000 + 2009);
    expect(Number.isInteger(invoice.totalCents)).toBe(true);
  });

  it("applies a FIXED_PRICE rule to later enrollments", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 3000), enrollment("C", 2500)],
      rules: [rule("FIXED_PRICE", 1500)],
    });
    expect((await family()).totalCents).toBe(4000 + 1500 + 1500);
  });

  it("never raises a price when the fixed price is above the class price", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 1000)],
      rules: [rule("FIXED_PRICE", 1500)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(5000);
    expect(invoice.lineItems.some((item) => item.type === "DISCOUNT")).toBe(false);
  });

  it("caps the family total with a FAMILY_CAP rule", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 3000), enrollment("C", 2000)],
      rules: [rule("FAMILY_CAP", 6000)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(6000);
    expect(invoice.lineItems.at(-1)).toEqual({
      description: "Family cap discount (max $60.00/period)",
      amountCents: -3000,
      type: "DISCOUNT",
    });
  });

  it("leaves the total alone when it is already under the cap", async () => {
    setup({ enrollments: [enrollment("A", 4000)], rules: [rule("FAMILY_CAP", 6000)] });
    const invoice = await family();
    expect(invoice.totalCents).toBe(4000);
    expect(invoice.lineItems).toHaveLength(1);
  });

  it("applies the cap after per-class discounts", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 4000), enrollment("C", 4000)],
      rules: [rule("PERCENT_OFF", 50), rule("FAMILY_CAP", 7000)],
    });
    // 4000 + 2000 + 2000 = 8000, capped to 7000
    expect((await family()).totalCents).toBe(7000);
  });

  it("applies scholarships after discounts, as negative line items", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 2000)],
      rules: [rule("PERCENT_OFF", 50)],
      scholarships: [scholarship("PERCENT", 20, "Merit")],
    });
    const invoice = await family();
    // 4000 + 1000 = 5000, then 20% off = 4000
    expect(invoice.totalCents).toBe(4000);
    expect(invoice.lineItems.at(-1)).toEqual({
      description: "Scholarship: Merit (20%)",
      amountCents: -1000,
      type: "SCHOLARSHIP",
    });
  });

  it("limits a FIXED scholarship to what is owed", async () => {
    setup({
      enrollments: [enrollment("A", 3000)],
      scholarships: [scholarship("FIXED", 5000)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(0);
    expect(invoice.lineItems.at(-1)?.amountCents).toBe(-3000);
  });

  it("zeroes the invoice with a WAIVER scholarship", async () => {
    setup({
      enrollments: [enrollment("A", 3000), enrollment("B", 2500)],
      scholarships: [scholarship("WAIVER", 0, "Full ride")],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(0);
    expect(invoice.lineItems.at(-1)).toEqual({
      description: "Scholarship: Full ride (Full waiver)",
      amountCents: -5500,
      type: "SCHOLARSHIP",
    });
  });

  it("keeps line items and total in agreement, and never goes negative", async () => {
    setup({
      enrollments: [enrollment("A", 4000), enrollment("B", 3333), enrollment("C", 1999)],
      rules: [rule("PERCENT_OFF", 15), rule("FAMILY_CAP", 8000)],
      scholarships: [scholarship("PERCENT", 33), scholarship("FIXED", 2500), scholarship("FIXED", 9999)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(0);
    expect(sum(invoice.lineItems)).toBe(invoice.totalCents);
    expect(invoice.enrollmentCount).toBe(3);
  });

  it("uses family-specific and global pricing rules", async () => {
    await family();
    expect(db.pricingRule.findMany.mock.calls[0]?.[0]).toBeUndefined();
    setup({ enrollments: [enrollment("A", 1000)] });
    await family();
    expect(db.pricingRule.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ familyGroupId: "fam-1" }, { isGlobal: true }],
    });
  });
});

describe("term registrations on a family invoice", () => {
  it("bills a semester registration once, with the term on the line", async () => {
    setup({ registrations: [registration("Ballet", "SEMESTER", 32000)] });
    const invoice = await family();
    expect(invoice.lineItems).toEqual([
      { description: "Ballet — Emma Thompson (Fall 2026)", amountCents: 32000, type: "TUITION" },
    ]);
    expect(invoice.totalCents).toBe(32000);
    expect(invoice.registrationCharges).toEqual([
      { registrationId: "reg-Ballet-Emma", periodKey: "full", amountCents: 32000 },
    ]);
  });

  it("does not bill a semester again once it is on an invoice", async () => {
    setup({ registrations: [registration("Ballet", "SEMESTER", 32000, { billed: ["full"] })] });
    expect(await family()).toMatchObject({ totalCents: 0, enrollmentCount: 0, lineItems: [] });
  });

  it("does not bill a registration made after the period", async () => {
    setup({
      registrations: [registration("Ballet", "SEMESTER", 32000, { createdAt: "2026-12-05T15:00:00Z" })],
    });
    expect((await family()).enrollmentCount).toBe(0);
  });

  it("bills one weekly instalment per week with a class in the period", async () => {
    setup({ registrations: [registration("Ballet", "WEEKLY", 2200)] });
    const invoice = await family();
    expect(invoice.lineItems.map((l) => l.description)).toEqual([
      "Ballet — Emma Thompson (week of Nov 9)",
      "Ballet — Emma Thompson (week of Nov 16)",
      "Ballet — Emma Thompson (week of Nov 23)",
      "Ballet — Emma Thompson (week of Nov 30)",
    ]);
    expect(invoice.totalCents).toBe(8800);
    expect(invoice.registrationCharges.map((c) => c.periodKey)).toEqual([
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  it("bills only the weeks not yet invoiced", async () => {
    setup({
      registrations: [registration("Ballet", "WEEKLY", 2200, { billed: ["2026-11-09", "2026-11-16"] })],
    });
    expect((await family()).totalCents).toBe(4400);
  });

  it("bills a monthly registration once for the month", async () => {
    setup({ registrations: [registration("Ballet", "MONTHLY", 8500)] });
    const invoice = await family();
    expect(invoice.lineItems).toEqual([
      { description: "Ballet — Emma Thompson (November 2026)", amountCents: 8500, type: "TUITION" },
    ]);
  });

  it("charges nothing for a registration with no held dates", async () => {
    setup({ registrations: [registration("Ballet", "MONTHLY", 8500, { days: [] })] });
    expect((await family()).enrollmentCount).toBe(0);
  });

  it("treats a registration as ONE enrollment for the multi-class discount", async () => {
    // Four weekly instalments must not discount each other
    setup({ registrations: [registration("Ballet", "WEEKLY", 2200)], rules: [rule("PERCENT_OFF", 50)] });
    const invoice = await family();
    expect(invoice.totalCents).toBe(8800);
    expect(invoice.lineItems.some((l) => l.type === "DISCOUNT")).toBe(false);
  });

  it("discounts the cheaper registration when a family has two", async () => {
    setup({
      registrations: [
        registration("Ballet", "MONTHLY", 8500),
        registration("Tiny Dancers", "MONTHLY", 6000, { student: "Olivia Thompson" }),
      ],
      rules: [rule("PERCENT_OFF", 50)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(8500 + 3000);
    expect(invoice.lineItems.at(-1)).toEqual({
      description: "Multi-class discount — Tiny Dancers — Olivia Thompson",
      amountCents: -3000,
      type: "DISCOUNT",
    });
    // The full instalment is still recorded as billed
    expect(invoice.registrationCharges).toHaveLength(2);
  });

  it("ranks registrations and single classes together by price", async () => {
    setup({
      enrollments: [enrollment("Jazz drop-in", 2800)],
      registrations: [registration("Ballet", "MONTHLY", 8500)],
      rules: [rule("PERCENT_OFF", 50)],
    });
    const invoice = await family();
    // The registration costs most, so it is full price; the single class is discounted
    expect(invoice.totalCents).toBe(8500 + 1400);
    expect(invoice.enrollmentCount).toBe(2);
  });

  it("never applies a FIXED_PRICE (per-class) rule to a registration", async () => {
    setup({
      enrollments: [enrollment("Jazz drop-in", 40000)],
      registrations: [registration("Ballet", "SEMESTER", 32000)],
      rules: [rule("FIXED_PRICE", 1500)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(40000 + 32000);
  });

  it("applies the family cap and scholarships across registrations too", async () => {
    setup({
      registrations: [registration("Ballet", "SEMESTER", 32000)],
      rules: [rule("FAMILY_CAP", 30000)],
      scholarships: [scholarship("PERCENT", 10)],
    });
    const invoice = await family();
    expect(invoice.totalCents).toBe(27000);
    expect(sum(invoice.lineItems)).toBe(27000);
  });
});

describe("generateStudentInvoice", () => {
  it("bills the registration of an adult student", async () => {
    setup({ registrations: [registration("Contemporary", "MONTHLY", 9000, { student: "Alex Rivera" })] });
    const invoice = await generateStudentInvoice({ studentId: "stu-1", ...period });
    expect(invoice.totalCents).toBe(9000);
    expect(invoice.registrationCharges).toEqual([
      { registrationId: "reg-Contemporary-Alex", periodKey: "2026-11", amountCents: 9000 },
    ]);
  });

  const student = () => generateStudentInvoice({ studentId: "stu-1", ...period });

  it("bills each enrollment at full price with no sibling discount", async () => {
    setup({ enrollments: [enrollment("A", 3000), enrollment("B", 2000)] });
    const invoice = await student();
    expect(invoice.totalCents).toBe(5000);
    expect(db.pricingRule.findMany).not.toHaveBeenCalled();
  });

  it("applies the student's scholarships", async () => {
    setup({
      enrollments: [enrollment("A", 3000)],
      scholarships: [scholarship("PERCENT", 50), scholarship("FIXED", 500)],
    });
    const invoice = await student();
    expect(invoice.totalCents).toBe(1000);
    expect(sum(invoice.lineItems)).toBe(1000);
  });

  it("returns zero when there is nothing to bill", async () => {
    setup({ scholarships: [scholarship("WAIVER", 0)] });
    expect(await student()).toEqual({
      lineItems: [],
      totalCents: 0,
      enrollmentCount: 0,
      registrationCharges: [],
    });
  });
});
