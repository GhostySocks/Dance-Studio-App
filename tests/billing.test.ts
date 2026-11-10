import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  enrollment: { findMany: vi.fn() },
  pricingRule: { findMany: vi.fn() },
  scholarship: { findMany: vi.fn() },
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

function setup({
  enrollments = [] as ReturnType<typeof enrollment>[],
  rules = [] as ReturnType<typeof rule>[],
  scholarships = [] as ReturnType<typeof scholarship>[],
}) {
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
    expect(await family()).toEqual({ lineItems: [], totalCents: 0, enrollmentCount: 0 });
  });

  it("only bills ACTIVE enrollments inside the billing period", async () => {
    await family();
    const where = db.enrollment.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("ACTIVE");
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

describe("generateStudentInvoice", () => {
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
    expect(await student()).toEqual({ lineItems: [], totalCents: 0, enrollmentCount: 0 });
  });
});
