"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

interface GenerateAllResult {
  created: { id: string; billTo: string; totalCents: number }[];
  totalCents: number;
  alreadyInvoiced: string[];
  nothingToBill: number;
  failed: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day of the current month, as the date inputs want them. */
function thisMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Bills everyone for a period in one go: a draft invoice for each family group
 * (covering all of its students) and for each student who is not in one.
 */
export function GenerateAllInvoices({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateAllResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const month = thisMonth();
    setStart(month.start);
    setEnd(month.end);
    setResult(null);
  }, [open]);

  async function onGenerate() {
    if (!start || !end) {
      toast.error("Choose the first and last day of the billing period");
      return;
    }
    if (end < start) {
      toast.error("The period must end on or after the day it starts");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/invoices/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStart: start, periodEnd: end }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Generation failed");
      const data: GenerateAllResult = json.data;
      setResult(data);
      if (data.created.length > 0) {
        toast.success(`${plural(data.created.length, "invoice", "invoices")} created`);
        onGenerated();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invoices");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate all invoices"
      description="Creates a draft invoice for everyone with something to pay in the period. Students in a family group share one invoice; everyone else gets their own."
    >
      {result ? (
        <div className="grid gap-4">
          <div aria-live="polite" className="grid gap-3 text-sm">
            <p className="text-base font-semibold">
              {result.created.length === 0
                ? "No invoices were created"
                : `${plural(result.created.length, "draft invoice", "draft invoices")} created, ${formatCurrency(result.totalCents)} in total`}
            </p>

            {result.created.length > 0 && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {result.created.map((invoice) => (
                  <li key={invoice.id} className="flex justify-between gap-4 px-3 py-2">
                    <span>{invoice.billTo}</span>
                    <span className="font-medium">{formatCurrency(invoice.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}

            {result.alreadyInvoiced.length > 0 && (
              <p className="text-muted-foreground">
                Skipped {plural(result.alreadyInvoiced.length, "account", "accounts")} already invoiced for
                this period: {result.alreadyInvoiced.join(", ")}.
              </p>
            )}
            {result.nothingToBill > 0 && (
              <p className="text-muted-foreground">
                {plural(result.nothingToBill, "account has", "accounts have")} nothing due in this period.
              </p>
            )}
            {result.failed.length > 0 && (
              <p className="text-destructive">
                Could not generate {plural(result.failed.length, "invoice", "invoices")}:{" "}
                {result.failed.join(", ")}. Try these one at a time.
              </p>
            )}
            {result.created.length > 0 && (
              <p className="text-muted-foreground">
                They are drafts: review them in the list, then send each one.
              </p>
            )}
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <RequiredNote />
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="all-period-start">
                Period start
                <RequiredMark />
              </Label>
              <Input
                id="all-period-start"
                type="date"
                aria-required="true"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="all-period-end">
                Period end
                <RequiredMark />
              </Label>
              <Input
                id="all-period-end"
                type="date"
                aria-required="true"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Anyone who already has an invoice for these dates is skipped, so it is safe to run again.
          </p>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={onGenerate} disabled={isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Generate invoices
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
