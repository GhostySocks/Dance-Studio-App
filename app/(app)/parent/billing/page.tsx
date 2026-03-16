"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, X, FileDown } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

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

function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-background p-6 shadow-lg ${className ?? ""}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function ParentBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/parent/invoices");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setInvoices(json.data || []);
      } catch {
        toast.error("Failed to load invoices");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  async function handlePay(invoiceId: string) {
    setPaying(invoiceId);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Payment failed");
      }

      const json = await res.json();

      // In production, you'd use Stripe Elements here with the clientSecret
      // For now, show success that payment intent was created
      toast.success(
        "Payment intent created. In production, this would open the Stripe checkout."
      );
      console.log("Stripe client secret:", json.data.clientSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      toast.error(message);
    } finally {
      setPaying(null);
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
