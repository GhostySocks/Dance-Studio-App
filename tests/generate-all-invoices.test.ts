import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  familyGroup: { findMany: vi.fn() },
  student: { findMany: vi.fn() },
  invoice: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const billing = vi.hoisted(() => ({
  generateFamilyInvoice: vi.fn(),
  generateStudentInvoice: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing", () => billing);

import { billingPeriod, mapWithLimit } from "@/lib/billing-period";
import { generateAllInvoices, markDraftInvoicesSent } from "@/lib/db/invoices";

const period = billingPeriod("America/New_York", "2026-11-01", "2026-11-30");

function bill(totalCents: number) {
  return {
    lineItems: [{ description: "Ballet", amountCents: totalCents, type: "TUITION" }],
    totalCents,
    enrollmentCount: totalCents > 0 ? 1 : 0,
    registrationCharges: [],
  };
}
const NOTHING = { lineItems: [], totalCents: 0, enrollmentCount: 0, registrationCharges: [] };

const run = () => generateAllInvoices({ ...period, actorId: "admin-1" });

beforeEach(() => {
  vi.clearAllMocks();
  db.familyGroup.findMany.mockResolvedValue([
    { id: "fam-1", name: "Thompson Family" },
    { id: "fam-2", name: "Garcia Family" },
  ]);
  db.student.findMany.mockResolvedValue([{ id: "stu-9", firstName: "Alex", lastName: "Rivera" }]);
  db.invoice.findMany.mockResolvedValue([]);
  let n = 0;
  db.invoice.create.mockImplementation(async ({ data }: { data: { totalCents: number } }) => ({
    id: `inv-${++n}`,
    totalCents: data.totalCents,
  }));
  billing.generateFamilyInvoice.mockResolvedValue(bill(9000));
  billing.generateStudentInvoice.mockResolvedValue(bill(3000));
});

describe("billingPeriod", () => {
  it("covers both chosen days in full in the studio timezone", () => {
    // New York is UTC-4 on Nov 1 (before the clocks change) and UTC-5 on Nov 30
    expect(period.periodStart.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(period.periodEnd.toISOString()).toBe("2026-12-01T04:59:59.000Z");
  });
});

describe("mapWithLimit", () => {
  it("keeps results in order and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 1));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBe(3);
  });

  it("handles an empty list", async () => {
    expect(await mapWithLimit([], 3, async (n: number) => n)).toEqual([]);
  });
});

describe("generateAllInvoices", () => {
  it("creates one invoice per family group and one per student outside a family", async () => {
    const result = await run();

    expect(billing.generateFamilyInvoice).toHaveBeenCalledTimes(2);
    expect(billing.generateStudentInvoice).toHaveBeenCalledTimes(1);
    expect(db.invoice.create).toHaveBeenCalledTimes(3);
    expect(result.created.map((c) => c.billTo)).toEqual(["Thompson Family", "Garcia Family", "Alex Rivera"]);
    expect(result.totalCents).toBe(21000);

    // Family invoices belong to the family, not to any one student
    const familyInvoice = db.invoice.create.mock.calls.find(
      ([args]) => args.data.familyGroupId === "fam-1"
    )?.[0];
    expect(familyInvoice.data.studentId).toBeNull();
    expect(familyInvoice.data.status).toBe("DRAFT");
  });

  it("only looks for own invoices among students with no family group", async () => {
    await run();
    expect(db.student.findMany.mock.calls[0][0].where.familyGroupId).toBeNull();
  });

  it("skips anyone already invoiced for an overlapping period, ignoring void invoices", async () => {
    db.invoice.findMany.mockResolvedValue([
      { familyGroupId: "fam-1", studentId: null },
      { familyGroupId: null, studentId: "stu-9" },
    ]);
    const result = await run();

    const where = db.invoice.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: "VOID" });
    expect(where.periodStart).toEqual({ lte: period.periodEnd });
    expect(where.periodEnd).toEqual({ gte: period.periodStart });

    expect(result.alreadyInvoiced).toEqual(["Thompson Family", "Alex Rivera"]);
    expect(result.created.map((c) => c.billTo)).toEqual(["Garcia Family"]);
    expect(db.invoice.create).toHaveBeenCalledTimes(1);
  });

  it("creates nothing the second time it is run for the same period", async () => {
    const first = await run();
    db.invoice.findMany.mockResolvedValue([
      { familyGroupId: "fam-1", studentId: null },
      { familyGroupId: "fam-2", studentId: null },
      { familyGroupId: null, studentId: "stu-9" },
    ]);
    const second = await run();
    expect(first.created).toHaveLength(3);
    expect(second.created).toHaveLength(0);
    expect(db.invoice.create).toHaveBeenCalledTimes(3);
  });

  it("creates no invoice when nothing is due", async () => {
    billing.generateStudentInvoice.mockResolvedValue(NOTHING);
    const result = await run();
    expect(result.nothingToBill).toBe(1);
    expect(result.created).toHaveLength(2);
  });

  it("carries on when one invoice fails, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    billing.generateFamilyInvoice.mockRejectedValueOnce(new Error("boom"));
    const result = await run();
    expect(result.failed).toEqual(["Thompson Family"]);
    expect(result.created.map((c) => c.billTo)).toEqual(["Garcia Family", "Alex Rivera"]);
  });

  it("records the run in the audit log", async () => {
    await run();
    const { data } = db.auditLog.create.mock.calls[0][0];
    expect(data.actorId).toBe("admin-1");
    expect(data.action).toBe("INVOICES_GENERATED");
    expect(data.meta).toMatchObject({ created: 3, totalCents: 21000, failed: 0 });
  });
});

describe("markDraftInvoicesSent", () => {
  const sendDb = db as typeof db & {
    invoice: { updateMany: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sendDb.invoice.updateMany = vi.fn().mockReturnValue("update");
    sendDb.$transaction = vi.fn().mockResolvedValue([]);
    db.auditLog.create.mockReturnValue("audit");
  });

  it("sends only the chosen invoices that are still drafts", async () => {
    db.invoice.findMany.mockResolvedValue([{ id: "inv-1" }, { id: "inv-3" }]);
    const result = await markDraftInvoicesSent({ ids: ["inv-1", "inv-2", "inv-3"], actorId: "admin-1" });

    expect(db.invoice.findMany.mock.calls[0][0].where).toEqual({
      status: "DRAFT",
      id: { in: ["inv-1", "inv-2", "inv-3"] },
    });
    expect(result).toEqual({ sentIds: ["inv-1", "inv-3"], skipped: 1 });

    const update = sendDb.invoice.updateMany.mock.calls[0][0];
    // Still guarded by status, so a paid or void invoice can never be flipped to sent
    expect(update.where).toEqual({ id: { in: ["inv-1", "inv-3"] }, status: "DRAFT" });
    expect(update.data).toEqual({ status: "SENT" });
  });

  it("sends every draft when no invoices are named", async () => {
    db.invoice.findMany.mockResolvedValue([{ id: "inv-1" }, { id: "inv-2" }]);
    const result = await markDraftInvoicesSent({ actorId: "admin-1" });
    expect(db.invoice.findMany.mock.calls[0][0].where).toEqual({ status: "DRAFT" });
    expect(result).toEqual({ sentIds: ["inv-1", "inv-2"], skipped: 0 });
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "INVOICES_SENT",
      meta: { count: 2, all: true },
    });
  });

  it("changes nothing when there are no drafts", async () => {
    db.invoice.findMany.mockResolvedValue([]);
    const result = await markDraftInvoicesSent({ ids: ["inv-9"], actorId: "admin-1" });
    expect(result).toEqual({ sentIds: [], skipped: 1 });
    expect(sendDb.$transaction).not.toHaveBeenCalled();
  });
});
