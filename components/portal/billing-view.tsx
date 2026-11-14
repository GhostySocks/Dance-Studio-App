"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, FileDown, RefreshCw } from "lucide-react";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StripeCardForm } from "@/components/forms/stripe-card-form";

interface LineItem {
  id: string;
  description: string;
  amountCents: number;
  type: string;
}

interface Invoice {
  id: string;
  status: string;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  student: { id: string; firstName: string; lastName: string } | null;
  familyGroup: { id: string; name: string } | null;
  lineItems: LineItem[];
  payments: { id: string; amountCents: number; status: string }[];
}

interface BillingAccount {
  type: "family" | "student";
  id: string;
  name: string;
  autoPayEnabled: boolean;
  hasCard: boolean;
}

/** An open Stripe card form: paying one invoice, or saving a card for auto-pay. */
type CardFlow =
  | { kind: "payment"; clientSecret: string; invoice: Invoice }
  | { kind: "setup"; clientSecret: string; account: BillingAccount };

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  return typeof json?.error === "string" ? json.error : fallback;
}

function invoiceStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PAID":
      return "default";
    case "SENT":
      return "secondary";
    case "OVERDUE":
      return "destructive";
    case "VOID":
      return "outline";
    default:
      return "outline";
  }
}

export function BillingView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const [cardFlow, setCardFlow] = useState<CardFlow | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [invoiceRes, accountRes] = await Promise.all([
        fetch("/api/parent/invoices"),
        fetch("/api/payments/auto-pay"),
      ]);
      if (!invoiceRes.ok) throw new Error("Failed");
      const invoiceJson = await invoiceRes.json();
      setInvoices(invoiceJson.data || []);
      if (accountRes.ok) {
        const accountJson = await accountRes.json();
        setAccounts(accountJson.data || []);
      }
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handlePay(invoiceId: string) {
    setPaying(invoiceId);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) throw new Error(await readError(res, "Payment failed"));

      const json = await res.json();
      const invoice = invoices.find((inv) => inv.id === invoiceId);
      if (invoice) {
        setCardFlow({ kind: "payment", clientSecret: json.data.clientSecret, invoice });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      toast.error(message);
    } finally {
      setPaying(null);
    }
  }

  async function handlePaymentConfirmed(paymentIntentId: string) {
    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    const json = await res.json().catch(() => null);
    setCardFlow(null);
    if (res.ok && json?.data?.status === "succeeded") {
      toast.success("Payment received. A receipt is on its way to your email.");
    } else {
      toast.info("Your payment is processing. This page will update once it clears.");
    }
    await loadData();
  }

  async function handleEnableAutoPay(account: BillingAccount) {
    setAccountBusy(account.id);
    try {
      const res = await fetch("/api/payments/auto-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: account.type, accountId: account.id }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not start auto-pay setup"));
      const json = await res.json();
      setCardFlow({ kind: "setup", clientSecret: json.data.clientSecret, account });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not start auto-pay setup");
    } finally {
      setAccountBusy(null);
    }
  }

  async function handleCardSaved(account: BillingAccount, setupIntentId: string) {
    const res = await fetch("/api/payments/auto-pay", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType: account.type, accountId: account.id, setupIntentId }),
    });
    if (!res.ok) throw new Error(await readError(res, "Card could not be verified"));
    setCardFlow(null);
    toast.success(`Auto-pay is on for ${account.name}`);
    await loadData();
  }

  async function handleDisableAutoPay(account: BillingAccount) {
    setAccountBusy(account.id);
    try {
      const res = await fetch("/api/payments/auto-pay", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType: account.type, accountId: account.id }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not turn off auto-pay"));
      toast.success(`Auto-pay is off for ${account.name}`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not turn off auto-pay");
    } finally {
      setAccountBusy(null);
    }
  }

  const unpaid = invoices.filter((inv) => ["SENT", "OVERDUE"].includes(inv.status));
  const paid = invoices.filter((inv) => inv.status === "PAID");
  const other = invoices.filter((inv) => !["SENT", "OVERDUE", "PAID"].includes(inv.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="View and pay your invoices"
      />

      {/* Outstanding Invoices */}
      {unpaid.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Outstanding</h2>
          <div className="space-y-3">
            {unpaid.map((invoice) => (
              <Card key={invoice.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {invoice.familyGroup?.name ||
                            (invoice.student
                              ? `${invoice.student.firstName} ${invoice.student.lastName}`
                              : "Invoice")}
                        </p>
                        <Badge variant={invoiceStatusVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                        {invoice.dueDate && ` · Due ${formatDate(invoice.dueDate)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold">{formatCurrency(invoice.totalCents)}</p>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDetailInvoice(invoice)}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="cta"
                          size="sm"
                          onClick={() => handlePay(invoice.id)}
                          disabled={paying === invoice.id}
                        >
                          {paying === invoice.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4 mr-1" />
                          )}
                          Pay
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {unpaid.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No outstanding invoices. You&apos;re all caught up!</p>
          </CardContent>
        </Card>
      )}

      {/* Auto-pay */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Auto-pay</h2>
          <div className="space-y-2">
            {accounts.map((account) => (
              <Card key={`${account.type}-${account.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{account.name}</p>
                          <Badge variant={account.autoPayEnabled ? "default" : "outline"}>
                            {account.autoPayEnabled ? "ON" : "OFF"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {account.autoPayEnabled
                            ? "New invoices are charged to your saved card automatically."
                            : "Save a card and each new invoice will be charged automatically."}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={accountBusy === account.id}
                      onClick={() =>
                        account.autoPayEnabled
                          ? handleDisableAutoPay(account)
                          : handleEnableAutoPay(account)
                      }
                    >
                      {accountBusy === account.id && (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      )}
                      {account.autoPayEnabled ? "Turn off" : "Set up"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {paid.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Payment History</h2>
          <div className="space-y-2">
            {paid.map((invoice) => (
              <Card key={invoice.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {invoice.familyGroup?.name ||
                          (invoice.student
                            ? `${invoice.student.firstName} ${invoice.student.lastName}`
                            : "Invoice")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">{formatCurrency(invoice.totalCents)}</p>
                      <Badge variant="default">PAID</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailInvoice(invoice)}
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Other</h2>
          <div className="space-y-2">
            {other.map((invoice) => (
              <Card key={invoice.id} className="opacity-60">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {invoice.familyGroup?.name ||
                          (invoice.student
                            ? `${invoice.student.firstName} ${invoice.student.lastName}`
                            : "Invoice")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm">{formatCurrency(invoice.totalCents)}</p>
                      <Badge variant={invoiceStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Card payment / auto-pay setup */}
      <Modal
        open={!!cardFlow}
        onClose={() => setCardFlow(null)}
        title={cardFlow?.kind === "setup" ? "Set up auto-pay" : "Pay invoice"}
      >
        {cardFlow?.kind === "payment" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatDate(cardFlow.invoice.periodStart)} – {formatDate(cardFlow.invoice.periodEnd)}
            </p>
            <StripeCardForm
              key={cardFlow.clientSecret}
              mode="payment"
              clientSecret={cardFlow.clientSecret}
              submitLabel={`Pay ${formatCurrency(cardFlow.invoice.totalCents)}`}
              onSuccess={handlePaymentConfirmed}
            />
          </div>
        )}
        {cardFlow?.kind === "setup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save a card for {cardFlow.account.name}. Each new invoice will be charged to it
              automatically, and you&apos;ll get a receipt by email. You can turn this off at any
              time.
            </p>
            <StripeCardForm
              key={cardFlow.clientSecret}
              mode="setup"
              clientSecret={cardFlow.clientSecret}
              submitLabel="Save card and turn on auto-pay"
              onSuccess={(setupIntentId) => handleCardSaved(cardFlow.account, setupIntentId)}
            />
          </div>
        )}
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        title="Invoice Details"
      >
        {detailInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Bill To: </span>
                <span className="font-medium">
                  {detailInvoice.familyGroup?.name ||
                    (detailInvoice.student
                      ? `${detailInvoice.student.firstName} ${detailInvoice.student.lastName}`
                      : "-")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <Badge variant={invoiceStatusVariant(detailInvoice.status)}>
                  {detailInvoice.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Period: </span>
                <span>
                  {formatDate(detailInvoice.periodStart)} – {formatDate(detailInvoice.periodEnd)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">{formatCurrency(detailInvoice.totalCents)}</span>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-center px-3 py-2 font-medium w-24">Type</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detailInvoice.lineItems.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-center text-xs">
                        <Badge variant="outline">{item.type}</Badge>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${item.amountCents < 0 ? "text-green-600" : ""}`}
                      >
                        {formatCurrency(item.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(detailInvoice.totalCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
