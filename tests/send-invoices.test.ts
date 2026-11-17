import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  markDraftInvoicesSent: vi.fn(),
  sendInvoiceEmail: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db/invoices", () => ({ markDraftInvoicesSent: mocks.markDraftInvoicesSent }));
vi.mock("@/lib/email", () => ({ sendInvoiceEmail: mocks.sendInvoiceEmail }));

import { POST } from "@/app/api/invoices/send/route";
import { sendInvoicesSchema } from "@/lib/validations/invoice";

const request = (body: unknown) =>
  new Request("http://localhost/api/invoices/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ session: { user: { id: "admin-1" } }, response: null });
  mocks.markDraftInvoicesSent.mockResolvedValue({ sentIds: ["inv-1", "inv-2"], skipped: 0 });
  mocks.sendInvoiceEmail.mockResolvedValue({ sent: true });
});

describe("POST /api/invoices/send", () => {
  it("emails each invoice it marks as sent", async () => {
    const res = await POST(request({ ids: ["inv-1", "inv-2"], email: true }));
    expect(mocks.markDraftInvoicesSent).toHaveBeenCalledWith({ ids: ["inv-1", "inv-2"], actorId: "admin-1", email: true });
    expect(mocks.sendInvoiceEmail.mock.calls).toEqual([
      ["inv-1", "sent"],
      ["inv-2", "sent"],
    ]);
    expect((await res.json()).data).toEqual({ sent: 2, emailed: 2, skipped: 0, emailRequested: true });
  });

  it("only marks them as sent, with no email, when email is turned off", async () => {
    const res = await POST(request({ ids: ["inv-1", "inv-2"], email: false }));
    expect(mocks.markDraftInvoicesSent).toHaveBeenCalledWith({ ids: ["inv-1", "inv-2"], actorId: "admin-1", email: false });
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
    expect((await res.json()).data).toEqual({ sent: 2, emailed: 0, skipped: 0, emailRequested: false });
  });

  it("sends nothing for someone who is not an administrator", async () => {
    mocks.requireAdmin.mockResolvedValue({ session: null, response: new Response(null, { status: 403 }) });
    const res = await POST(request({ email: true }));
    expect(res.status).toBe(403);
    expect(mocks.markDraftInvoicesSent).not.toHaveBeenCalled();
    expect(mocks.sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it("emails by default, so older callers keep working", () => {
    expect(sendInvoicesSchema.parse({})).toEqual({ email: true });
  });
});
