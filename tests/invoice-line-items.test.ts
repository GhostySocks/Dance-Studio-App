import { beforeEach, describe, expect, it, vi } from "vitest";

interface Line {
  id: string;
  description: string;
  amountCents: number;
  custom: boolean;
}

const state = vi.hoisted(() => ({
  status: "DRAFT" as string,
  lines: [] as Line[],
  totalCents: 0,
  audit: [] as { action: string }[],
}));

const db = vi.hoisted(() => {
  const tx = {
    invoice: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "inv-1" ? { status: state.status, lineItems: state.lines.map((l) => ({ ...l })) } : null
      ),
      update: vi.fn(async ({ data }: { data: { totalCents: number } }) => {
        state.totalCents = data.totalCents;
        return { id: "inv-1", totalCents: data.totalCents, lineItems: state.lines };
      }),
    },
    invoiceLineItem: {
      create: vi.fn(async ({ data }: { data: Omit<Line, "id"> }) => {
        state.lines.push({ ...data, id: `line-${state.lines.length + 1}` });
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        state.lines = state.lines.filter((l) => l.id !== where.id);
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string } }) => {
        state.audit.push(data);
      }),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/billing", () => ({}));

import { addInvoiceLineItem, removeInvoiceLineItem } from "@/lib/db/invoices";
import { invoiceLineItemSchema } from "@/lib/validations/invoice";

const add = (line: { kind: "CHARGE" | "DISCOUNT"; description?: string; amountCents?: number; percent?: number }) =>
  addInvoiceLineItem({ invoiceId: "inv-1", description: "Extra", actorId: "admin-1", ...line });
const remove = (lineItemId: string) =>
  removeInvoiceLineItem({ invoiceId: "inv-1", lineItemId, actorId: "admin-1" });

beforeEach(() => {
  vi.clearAllMocks();
  state.status = "DRAFT";
  state.audit = [];
  // $80.00 tuition with a $20.00 multi-class discount from the billing engine
  state.lines = [
    { id: "tuition", description: "Ballet", amountCents: 8000, custom: false },
    { id: "auto-discount", description: "Second class", amountCents: -2000, custom: false },
  ];
  state.totalCents = 6000;
});

describe("addInvoiceLineItem", () => {
  it("adds a charge as a fee and raises the total", async () => {
    const invoice = await add({ kind: "CHARGE", description: "Costume fee", amountCents: 4500 });
    expect(state.lines.at(-1)).toMatchObject({
      description: "Costume fee",
      amountCents: 4500,
      type: "FEE",
      custom: true,
    });
    expect(invoice.totalCents).toBe(10500);
    expect(state.audit[0].action).toBe("INVOICE_LINE_ADDED");
  });

  it("adds a discount as a negative line", async () => {
    await add({ kind: "DISCOUNT", amountCents: 1000 });
    expect(state.lines.at(-1)).toMatchObject({ amountCents: -1000, type: "DISCOUNT", custom: true });
    expect(state.totalCents).toBe(5000);
  });

  it("takes a percentage from the charges, not from the discounted total", async () => {
    await add({ kind: "DISCOUNT", description: "Staff", percent: 10 });
    expect(state.lines.at(-1)).toMatchObject({ description: "Staff (10%)", amountCents: -800 });
    expect(state.totalCents).toBe(5200);
  });

  it("rounds a percentage to whole cents", async () => {
    state.lines = [{ id: "tuition", description: "Ballet", amountCents: 3335, custom: false }];
    await add({ kind: "DISCOUNT", percent: 10 });
    expect(Number.isInteger(state.totalCents)).toBe(true);
    expect(state.lines.at(-1)?.amountCents).toBe(-334);
  });

  it("refuses a discount bigger than the invoice", async () => {
    await expect(add({ kind: "DISCOUNT", amountCents: 6001 })).rejects.toThrow(/more than the invoice total/);
    expect(state.lines).toHaveLength(2);
    expect(state.totalCents).toBe(6000);
  });

  it("allows a discount that brings the invoice to exactly zero", async () => {
    await add({ kind: "DISCOUNT", amountCents: 6000 });
    expect(state.totalCents).toBe(0);
  });

  it.each(["SENT", "PAID", "OVERDUE", "VOID"])("refuses to change a %s invoice", async (status) => {
    state.status = status;
    await expect(add({ kind: "CHARGE", amountCents: 500 })).rejects.toThrow(/Only draft invoices/);
    expect(state.lines).toHaveLength(2);
  });

  it("reports a missing invoice", async () => {
    await expect(
      addInvoiceLineItem({ invoiceId: "nope", kind: "CHARGE", description: "x", amountCents: 1, actorId: "a" })
    ).rejects.toThrow(/not found/);
  });
});

describe("removeInvoiceLineItem", () => {
  it("removes a hand-added line and restores the total", async () => {
    await add({ kind: "CHARGE", amountCents: 4500 });
    const id = state.lines.at(-1)!.id;
    await remove(id);
    expect(state.lines.map((l) => l.id)).toEqual(["tuition", "auto-discount"]);
    expect(state.totalCents).toBe(6000);
    expect(state.audit.at(-1)?.action).toBe("INVOICE_LINE_REMOVED");
  });

  it("never removes a line the billing engine produced", async () => {
    await expect(remove("tuition")).rejects.toThrow(/added yourself/);
    expect(state.lines).toHaveLength(2);
  });

  it("refuses to remove a charge when that would leave a negative total", async () => {
    await add({ kind: "CHARGE", amountCents: 4000 });
    const chargeId = state.lines.at(-1)!.id;
    await add({ kind: "DISCOUNT", amountCents: 9000 });
    await expect(remove(chargeId)).rejects.toThrow(/Remove the discount first/);
    expect(state.totalCents).toBe(1000);
  });

  it("refuses once the invoice has been sent", async () => {
    await add({ kind: "CHARGE", amountCents: 500 });
    state.status = "SENT";
    await expect(remove(state.lines.at(-1)!.id)).rejects.toThrow(/Only draft invoices/);
  });
});

describe("invoiceLineItemSchema", () => {
  const ok = (input: unknown) => invoiceLineItemSchema.safeParse(input).success;

  it("accepts a charge with an amount and a discount with an amount or a percentage", () => {
    expect(ok({ kind: "CHARGE", description: "Fee", amountCents: 500 })).toBe(true);
    expect(ok({ kind: "DISCOUNT", description: "Off", amountCents: 500 })).toBe(true);
    expect(ok({ kind: "DISCOUNT", description: "Off", percent: 12.5 })).toBe(true);
  });

  it("rejects negative, fractional and missing amounts", () => {
    expect(ok({ kind: "CHARGE", description: "Fee", amountCents: -500 })).toBe(false);
    expect(ok({ kind: "CHARGE", description: "Fee", amountCents: 10.5 })).toBe(false);
    expect(ok({ kind: "CHARGE", description: "Fee" })).toBe(false);
    expect(ok({ kind: "CHARGE", description: "Fee", percent: 10 })).toBe(false);
    expect(ok({ kind: "DISCOUNT", description: "Off", amountCents: 500, percent: 10 })).toBe(false);
    expect(ok({ kind: "DISCOUNT", description: "Off", percent: 101 })).toBe(false);
    expect(ok({ kind: "CHARGE", description: "  ", amountCents: 500 })).toBe(false);
  });
});
