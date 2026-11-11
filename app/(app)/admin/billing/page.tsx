"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Send, CheckCircle, Ban, FileDown, Files, Loader2 } from "lucide-react";

import { GenerateAllInvoices } from "@/components/forms/generate-all-invoices";
import dynamic from "next/dynamic";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

// Dynamically import PDF components (client-only)
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const InvoicePDFComponent = dynamic(
  () => import("@/components/pdf/invoice-pdf").then((mod) => {
    // Return a wrapper that renders the PDF
    const Wrapper = (props: Parameters<typeof mod.InvoicePDF>[0]) => {
      return <mod.InvoicePDF {...props} />;
    };
    Wrapper.displayName = "InvoicePDFWrapper";
    return Wrapper;
  }),
  { ssr: false }
);

interface InvoiceRow {
  id: string;
  status: string;
  totalCents: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string } | null;
  familyGroup: { id: string; name: string } | null;
  lineItems: {
    id: string;
    description: string;
    amountCents: number;
    type: string;
  }[];
  payments: { id: string; amountCents: number; status: string }[];
}

interface Family {
  id: string;
  name: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
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

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateAllOpen, setGenerateAllOpen] = useState(false);
  const [genType, setGenType] = useState<"family" | "student">("family");
  const [genTargetId, setGenTargetId] = useState("");
  const [genPeriodStart, setGenPeriodStart] = useState("");
  const [genPeriodEnd, setGenPeriodEnd] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [detailInvoice, setDetailInvoice] = useState<InvoiceRow | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setInvoices(json.data.invoices);
      setTotalPages(json.data.totalPages);
    } catch {
      toast.error("Failed to load invoices");
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [famRes, stuRes] = await Promise.all([
          fetch("/api/families?perPage=100"),
          fetch("/api/students?perPage=200"),
        ]);
        if (famRes.ok) {
          const json = await famRes.json();
          setFamilies(json.data.families);
        }
        if (stuRes.ok) {
          const json = await stuRes.json();
          setStudents(json.data.students);
        }
      } catch {
        // silent
      }
    }
    fetchData();
  }, []);

  function openGenerateDialog() {
    setGenType("family");
    setGenTargetId("");
    setGenPeriodStart("");
    setGenPeriodEnd("");
    setGenerateOpen(true);
  }

  async function onGenerate() {
    if (!genTargetId || !genPeriodStart || !genPeriodEnd) {
      toast.error("Please fill in all fields");
      return;
    }
    setIsGenerating(true);
    try {
      const body: Record<string, string> = {
        periodStart: genPeriodStart,
        periodEnd: genPeriodEnd,
      };
      if (genType === "family") body.familyGroupId = genTargetId;
      else body.studentId = genTargetId;

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Generation failed");
      }
      toast.success(json.message || "Invoice generated");
      setGenerateOpen(false);
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate invoice";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateStatus(invoiceId: string, status: string) {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(typeof json.error === "string" ? json.error : "Update failed");
      }
      toast.success(`Invoice marked as ${status}`);
      fetchInvoices();
      if (detailInvoice?.id === invoiceId) {
        setDetailInvoice(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error(message);
    }
  }

  const columns: ColumnDef<InvoiceRow>[] = useMemo(
    () => [
      {
        accessorKey: "billTo",
        header: "Bill To",
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <button
              className="font-medium text-left hover:underline"
              onClick={() => setDetailInvoice(inv)}
            >
              {inv.familyGroup
                ? inv.familyGroup.name
                : inv.student
                  ? `${inv.student.firstName} ${inv.student.lastName}`
                  : "-"}
            </button>
          );
        },
      },
      {
        accessorKey: "period",
        header: "Period",
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}
          </span>
        ),
      },
      {
        accessorKey: "totalCents",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-medium">{formatCurrency(row.original.totalCents)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={invoiceStatusVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex items-center gap-1">
              {inv.status === "DRAFT" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateStatus(inv.id, "SENT")}
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {(inv.status === "SENT" || inv.status === "OVERDUE") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateStatus(inv.id, "PAID")}
                  title="Mark Paid"
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </Button>
              )}
              {(inv.status === "DRAFT" || inv.status === "SENT") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateStatus(inv.id, "VOID")}
                  title="Void"
                >
                  <Ban className="h-4 w-4 text-destructive" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailInvoice(inv)}
                title="View Details"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Generate and manage invoices">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openGenerateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            One Invoice
          </Button>
          <Button onClick={() => setGenerateAllOpen(true)}>
            <Files className="h-4 w-4 mr-2" />
            Generate All Invoices
          </Button>
        </div>
      </PageHeader>

      <GenerateAllInvoices
        open={generateAllOpen}
        onClose={() => setGenerateAllOpen(false)}
        onGenerated={() => {
          setPage(1);
          fetchInvoices();
        }}
      />

      <div className="flex items-center gap-4">
        <StyledSelect
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          options={[
            { value: "", label: "All Statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "SENT", label: "Sent" },
            { value: "PAID", label: "Paid" },
            { value: "OVERDUE", label: "Overdue" },
            { value: "VOID", label: "Void" },
          ]}
          placeholder="All Statuses"
        />
      </div>

      <Card className="rounded-2xl border-0 shadow-md">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={invoices}
            pageCount={totalPages}
            page={page}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      {/* Generate Invoice Modal */}
      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate Invoice"
        description="Create an invoice for a family group or individual student."
      >
        <div className="grid gap-4">
          <RequiredNote />
          <div className="grid gap-2">
            <Label>Invoice For<RequiredMark /></Label>
            <StyledSelect
              value={genType}
              onChange={(val) => {
                setGenType(val as "family" | "student");
                setGenTargetId("");
              }}
              options={[
                { value: "family", label: "Family Group" },
                { value: "student", label: "Individual Student" },
              ]}
              placeholder="Select..."
            />
          </div>

          <div className="grid gap-2">
            <Label>
              {genType === "family" ? "Family Group" : "Student"}
              <RequiredMark />
            </Label>
            <StyledSelect
              value={genTargetId}
              onChange={(val) => setGenTargetId(val)}
              options={
                genType === "family"
                  ? families.map((f) => ({ value: f.id, label: f.name }))
                  : students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))
              }
              placeholder="Select..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Period Start<RequiredMark /></Label>
              <input
                type="date"
                value={genPeriodStart}
                onChange={(e) => setGenPeriodStart(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-2">
              <Label>Period End<RequiredMark /></Label>
              <input
                type="date"
                value={genPeriodEnd}
                onChange={(e) => setGenPeriodEnd(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onGenerate} disabled={isGenerating}>
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        title="Invoice Details"
        className="max-w-2xl"
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
                <span>{formatDate(detailInvoice.periodStart)} – {formatDate(detailInvoice.periodEnd)}</span>
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
                      <td className={`px-3 py-2 text-right font-medium ${item.amountCents < 0 ? "text-green-600" : ""}`}>
                        {formatCurrency(item.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(detailInvoice.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                {typeof window !== "undefined" && PDFDownloadLink && InvoicePDFComponent && (
                  <PDFDownloadLink
                    document={<InvoicePDFComponent invoice={detailInvoice} />}
                    fileName={`invoice-${detailInvoice.id.slice(-8)}.pdf`}
                  >
                    {({ loading: pdfLoading }) => (
                      <Button variant="outline" size="sm" disabled={pdfLoading}>
                        <FileDown className="h-4 w-4 mr-2" />
                        {pdfLoading ? "Generating PDF..." : "Download PDF"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                )}
              </div>
              <div className="flex gap-2">
                {detailInvoice.status === "DRAFT" && (
                  <Button size="sm" onClick={() => updateStatus(detailInvoice.id, "SENT")}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                )}
                {(detailInvoice.status === "SENT" || detailInvoice.status === "OVERDUE") && (
                  <Button size="sm" onClick={() => updateStatus(detailInvoice.id, "PAID")}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Paid
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
