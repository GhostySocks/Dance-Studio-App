import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  type Payment = { id: string; invoiceId: string; amountCents: number; status: string; stripePaymentIntentId: string };
  type Invoice = { id: string; totalCents: number; status: string };
  const state = { payments: [] as Payment[], invoices: [] as Invoice[] };

  const tables = {
    payment: {
      findUnique: async ({ where }: { where: { stripePaymentIntentId: string } }) =>
        state.payments.find((p) => p.stripePaymentIntentId === where.stripePaymentIntentId) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string | { not: string } };
        data: { status: string };
      }) => {
        const hit = state.payments.filter(
          (p) =>
            p.id === where.id &&
            (typeof where.status === "string" ? p.status === where.status : p.status !== where.status.not)
        );
        hit.forEach((p) => (p.status = data.status));
        return { count: hit.length };
      },
      aggregate: async ({ where }: { where: { invoiceId: string; status: string } }) => ({
        _sum: {
          amountCents: state.payments
            .filter((p) => p.invoiceId === where.invoiceId && p.status === where.status)
            .reduce((total, p) => total + p.amountCents, 0),
        },
      }),
    },
    invoice: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.invoices.find((i) => i.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const invoice = state.invoices.find((i) => i.id === where.id)!;
        invoice.status = data.status;
        return invoice;
      },
    },
  };
  const prisma = { ...tables, $transaction: async (fn: (tx: typeof tables) => unknown) => fn(tables) };
  return { state, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: store.prisma }));

const email = vi.hoisted(() => ({ sendInvoiceEmail: vi.fn(), sendAdminNotice: vi.fn() }));
vi.mock("@/lib/email", () => email);
vi.mock("@/lib/stripe", () => ({ stripe: null }));

import { markPaymentFailed, markPaymentPaid } from "@/lib/db/payments";
import { settlePaymentFailed, settlePaymentSucceeded } from "@/lib/payment-service";

const invoice = () => store.state.invoices[0];

beforeEach(() => {
  store.state.invoices = [{ id: "inv-1", totalCents: 5000, status: "SENT" }];
  store.state.payments = [
    { id: "pay-1", invoiceId: "inv-1", amountCents: 5000, status: "PENDING", stripePaymentIntentId: "pi_1" },
  ];
});

describe("markPaymentPaid", () => {
  it("marks the payment and the invoice paid", async () => {
    expect(await markPaymentPaid("pi_1")).toEqual({ invoiceId: "inv-1", newlyPaid: true, invoicePaid: true });
    expect(store.state.payments[0].status).toBe("PAID");
    expect(invoice().status).toBe("PAID");
  });

  it("is idempotent: a second call changes nothing and reports not newly paid", async () => {
    await markPaymentPaid("pi_1");
    expect(await markPaymentPaid("pi_1")).toEqual({ invoiceId: "inv-1", newlyPaid: false, invoicePaid: false });
    expect(invoice().status).toBe("PAID");
  });

  it("returns null for a PaymentIntent we never recorded", async () => {
    expect(await markPaymentPaid("pi_unknown")).toBeNull();
    expect(invoice().status).toBe("SENT");
  });

  it("leaves the invoice unpaid until payments cover the full total", async () => {
    store.state.payments[0].amountCents = 2000;
    store.state.payments.push({
      id: "pay-2", invoiceId: "inv-1", amountCents: 3000, status: "PENDING", stripePaymentIntentId: "pi_2",
    });

    expect((await markPaymentPaid("pi_1"))?.invoicePaid).toBe(false);
    expect(invoice().status).toBe("SENT");

    expect((await markPaymentPaid("pi_2"))?.invoicePaid).toBe(true);
    expect(invoice().status).toBe("PAID");
  });

  it("never reopens a VOID invoice", async () => {
    invoice().status = "VOID";
    expect((await markPaymentPaid("pi_1"))?.invoicePaid).toBe(false);
    expect(invoice().status).toBe("VOID");
  });

  it("marks an OVERDUE invoice paid", async () => {
    invoice().status = "OVERDUE";
    await markPaymentPaid("pi_1");
    expect(invoice().status).toBe("PAID");
  });

  it("can settle a payment that previously failed", async () => {
    store.state.payments[0].status = "FAILED";
    expect((await markPaymentPaid("pi_1"))?.newlyPaid).toBe(true);
  });
});

describe("markPaymentFailed", () => {
  it("fails a pending payment once", async () => {
    expect(await markPaymentFailed("pi_1")).toEqual({ invoiceId: "inv-1", newlyFailed: true });
    expect(await markPaymentFailed("pi_1")).toEqual({ invoiceId: "inv-1", newlyFailed: false });
    expect(invoice().status).toBe("SENT");
  });

  it("does not overwrite a payment that already succeeded", async () => {
    await markPaymentPaid("pi_1");
    expect((await markPaymentFailed("pi_1"))?.newlyFailed).toBe(false);
    expect(store.state.payments[0].status).toBe("PAID");
  });

  it("returns null for an unknown PaymentIntent", async () => {
    expect(await markPaymentFailed("pi_unknown")).toBeNull();
  });
});

describe("settlement emails", () => {
  it("sends exactly one receipt even when webhook and browser both report success", async () => {
    await settlePaymentSucceeded("pi_1");
    await settlePaymentSucceeded("pi_1");
    expect(email.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(email.sendInvoiceEmail).toHaveBeenCalledWith("inv-1", "receipt");
  });

  it("sends no receipt for a partial payment", async () => {
    store.state.payments[0].amountCents = 100;
    await settlePaymentSucceeded("pi_1");
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("sends exactly one failure notice", async () => {
    await settlePaymentFailed("pi_1");
    await settlePaymentFailed("pi_1");
    expect(email.sendInvoiceEmail).toHaveBeenCalledTimes(1);
    expect(email.sendInvoiceEmail).toHaveBeenCalledWith("inv-1", "failed");
  });

  it("ignores events for unknown PaymentIntents", async () => {
    expect(await settlePaymentSucceeded("pi_unknown")).toBeNull();
    expect(await settlePaymentFailed("pi_unknown")).toBeNull();
    expect(email.sendInvoiceEmail).not.toHaveBeenCalled();
  });
});
