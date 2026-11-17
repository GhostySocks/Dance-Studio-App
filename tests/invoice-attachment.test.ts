import { describe, expect, it } from "vitest";

import { buildInvoiceAttachment } from "@/lib/invoice-attachment";

const invoice = {
  id: "cmabc12345x7k2p9qd",
  status: "SENT",
  totalCents: 17500,
  periodStart: new Date("2026-11-01T05:00:00.000Z"),
  periodEnd: new Date("2026-12-01T04:59:59.999Z"),
  dueDate: null,
  familyGroup: { name: "Chen Family" },
  lineItems: [
    { id: "1", description: "Beginner Ballet", amountCents: 12000, type: "TUITION" },
    { id: "2", description: "Hip Hop Foundations", amountCents: 11000, type: "TUITION" },
    { id: "3", description: "Second class discount", amountCents: -5500, type: "DISCOUNT" },
  ],
};

describe("the invoice PDF attached to emails", () => {
  it("is a PDF file named after the invoice number", async () => {
    const attachment = await buildInvoiceAttachment(invoice, { name: "Boss Dance Studio", timezone: "America/New_York" });
    expect(attachment.filename).toBe("invoice-X7K2P9QD.pdf");
    expect(attachment.content.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(attachment.content.length).toBeGreaterThan(1000);
  }, 20_000);
});
