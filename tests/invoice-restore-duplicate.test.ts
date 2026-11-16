import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeInvoice {
  id: string;
  status: string;
  studentId: string | null;
  familyGroupId: string | null;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date | null;
  totalCents: number;
  payments: number;
  lineItems: { description: string; amountCents: number; type: string; custom?: boolean }[];
}

const state = vi.hoisted(() => ({ invoices: [] as FakeInvoice[], audit: [] as string[] }));

const db = vi.hoisted(() => {
  const tx = {
    invoice: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = state.invoices.find((i) => i.id === where.id);
        return row ? { ...row, _count: { payments: row.payments } } : null;
      }),
      // The "has this account been invoiced again for this period?" lookup
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            id: { not: string };
            studentId: string | null;
            familyGroupId: string | null;
            periodStart: { lte: Date };
            periodEnd: { gte: Date };
          };
        }) =>
          state.invoices.find(
            (i) =>
              i.id !== where.id.not &&
              i.status !== "VOID" &&
              i.studentId === where.studentId &&
              i.familyGroupId === where.familyGroupId &&
              i.periodStart <= where.periodStart.lte &&
              i.periodEnd >= where.periodEnd.gte
          ) ?? null
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const row = state.invoices.find((i) => i.id === where.id)!;
        row.status = data.status;
        return row;
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<FakeInvoice, "id" | "payments" | "lineItems"> & {
            lineItems: { create: FakeInvoice["lineItems"] };
          };
        }) => {
          const row = { ...data, id: `copy-${state.invoices.length}`, payments: 0, lineItems: data.lineItems.create };
          state.invoices.push(row);
          return row;
        }
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string } }) => {
        state.audit.push(data.action);
      }),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing", () => ({}));

import { duplicateInvoice, restoreVoidedInvoice } from "@/lib/db/invoices";

const march = { periodStart: new Date("2026-03-01T05:00:00Z"), periodEnd: new Date("2026-04-01T03:59:59Z") };

function invoice(overrides: Partial<FakeInvoice>): FakeInvoice {
  return {
    id: "inv-1",
    status: "VOID",
    studentId: null,
    familyGroupId: "fam-1",
    ...march,
    dueDate: new Date("2026-05-01T03:59:59Z"),
    totalCents: 5400,
    payments: 0,
    lineItems: [
      { description: "Ballet", amountCents: 9000, type: "TUITION" },
      { description: "Sibling discount", amountCents: -3600, type: "DISCOUNT" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.audit = [];
  state.invoices = [invoice({})];
});

describe("restoreVoidedInvoice", () => {
  it("brings a void invoice back as a draft", async () => {
    const restored = await restoreVoidedInvoice("inv-1", "admin-1");
    expect(restored.status).toBe("DRAFT");
    expect(state.audit).toEqual(["INVOICE_RESTORED"]);
  });

  it("brings it back as sent when a payment was recorded against it", async () => {
    state.invoices[0].payments = 1;
    expect((await restoreVoidedInvoice("inv-1", "admin-1")).status).toBe("SENT");
  });

  it.each(["DRAFT", "SENT", "PAID", "OVERDUE"])("refuses an invoice that is %s", async (status) => {
    state.invoices[0].status = status;
    await expect(restoreVoidedInvoice("inv-1", "admin-1")).rejects.toThrow(/Only a void invoice/);
  });

  it("refuses when the same account has been invoiced again for that period", async () => {
    state.invoices.push(invoice({ id: "inv-2", status: "DRAFT" }));
    await expect(restoreVoidedInvoice("inv-1", "admin-1")).rejects.toThrow(/bill twice/);
    expect(state.invoices[0].status).toBe("VOID");
  });

  it("is not blocked by another void invoice, another account or another period", async () => {
    state.invoices.push(
      invoice({ id: "void-too", status: "VOID" }),
      invoice({ id: "other-family", status: "SENT", familyGroupId: "fam-2" }),
      invoice({
        id: "april",
        status: "SENT",
        periodStart: new Date("2026-04-01T04:00:00Z"),
        periodEnd: new Date("2026-05-01T03:59:59Z"),
      })
    );
    expect((await restoreVoidedInvoice("inv-1", "admin-1")).status).toBe("DRAFT");
  });

  it("reports a missing invoice", async () => {
    await expect(restoreVoidedInvoice("nope", "admin-1")).rejects.toThrow(/not found/);
  });
});

describe("duplicateInvoice", () => {
  it("copies the bill-to, period, lines and total into a new draft", async () => {
    state.invoices[0].status = "PAID";
    const copy = await duplicateInvoice("inv-1", "admin-1");
    expect(copy).toMatchObject({
      status: "DRAFT",
      familyGroupId: "fam-1",
      studentId: null,
      periodStart: march.periodStart,
      periodEnd: march.periodEnd,
      totalCents: 5400,
    });
    expect(copy.id).not.toBe("inv-1");
    expect(state.invoices[0].status).toBe("PAID");
    expect(state.audit).toEqual(["INVOICE_DUPLICATED"]);
  });

  it("makes every copied line editable", async () => {
    const copy = await duplicateInvoice("inv-1", "admin-1");
    expect(copy.lineItems).toEqual([
      { description: "Ballet", amountCents: 9000, type: "TUITION", custom: true },
      { description: "Sibling discount", amountCents: -3600, type: "DISCOUNT", custom: true },
    ]);
  });

  it("does not copy the record of which term instalments were billed", async () => {
    await duplicateInvoice("inv-1", "admin-1");
    const { data } = db.invoice.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data).not.toHaveProperty("registrationCharges");
  });

  it("reports a missing invoice", async () => {
    await expect(duplicateInvoice("nope", "admin-1")).rejects.toThrow(/not found/);
  });
});
