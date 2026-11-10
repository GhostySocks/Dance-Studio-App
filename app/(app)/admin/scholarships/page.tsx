"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Settings } from "lucide-react";

import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StyledSelect } from "@/components/styled-select";

interface ScholarshipRow {
  id: string;
  name: string;
  type: string;
  value: number;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  student: { id: string; firstName: string; lastName: string } | null;
  familyGroup: { id: string; name: string } | null;
}

interface PricingRule {
  id: string;
  name: string;
  triggerCount: number;
  discountType: string;
  discountValue: number;
  isGlobal: boolean;
  familyGroup: { id: string; name: string } | null;
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

export default function ScholarshipsPage() {
  const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Scholarship form
  const [schOpen, setSchOpen] = useState(false);
  const [editingSch, setEditingSch] = useState<ScholarshipRow | null>(null);
  const [schName, setSchName] = useState("");
  const [schType, setSchType] = useState<"PERCENT" | "FIXED" | "WAIVER">("PERCENT");
  const [schValue, setSchValue] = useState("");
  const [schTarget, setSchTarget] = useState<"student" | "family">("student");
  const [schTargetId, setSchTargetId] = useState("");
  const [schStartDate, setSchStartDate] = useState("");
  const [schEndDate, setSchEndDate] = useState("");
  const [schNotes, setSchNotes] = useState("");
  const [schSubmitting, setSchSubmitting] = useState(false);

  // Pricing rule form
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("2");
  const [ruleDiscountType, setRuleDiscountType] = useState<"PERCENT_OFF" | "FIXED_PRICE" | "FAMILY_CAP">("PERCENT_OFF");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleGlobal, setRuleGlobal] = useState(true);
  const [ruleFamilyId, setRuleFamilyId] = useState("");
  const [ruleSubmitting, setRuleSubmitting] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "scholarship" | "rule"; id: string } | null>(null);

  const fetchScholarships = useCallback(async () => {
    try {
      const res = await fetch(`/api/scholarships?page=${page}&perPage=20`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setScholarships(json.data.scholarships);
      setTotalPages(json.data.totalPages);
    } catch {
      toast.error("Failed to load scholarships");
    }
  }, [page]);

  const fetchPricingRules = useCallback(async () => {
    try {
      const res = await fetch("/api/pricing-rules");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setPricingRules(json.data);
    } catch {
      toast.error("Failed to load pricing rules");
    }
  }, []);

  useEffect(() => {
    fetchScholarships();
  }, [fetchScholarships]);

  useEffect(() => {
    fetchPricingRules();
  }, [fetchPricingRules]);

  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  // ─── Scholarship CRUD ────────────────────────────────────────────────

  function openAddScholarship() {
    setEditingSch(null);
    setSchName("");
    setSchType("PERCENT");
    setSchValue("");
    setSchTarget("student");
    setSchTargetId("");
    setSchStartDate("");
    setSchEndDate("");
    setSchNotes("");
    setSchOpen(true);
  }

  function openEditScholarship(s: ScholarshipRow) {
    setEditingSch(s);
    setSchName(s.name);
    setSchType(s.type as "PERCENT" | "FIXED" | "WAIVER");
    setSchValue(String(s.value));
    setSchTarget(s.familyGroup ? "family" : "student");
    setSchTargetId(s.familyGroup?.id || s.student?.id || "");
    setSchStartDate(new Date(s.startDate).toISOString().split("T")[0]);
    setSchEndDate(s.endDate ? new Date(s.endDate).toISOString().split("T")[0] : "");
    setSchNotes(s.notes || "");
    setSchOpen(true);
  }

  async function onSubmitScholarship() {
    setSchSubmitting(true);
    try {
      const body = {
        name: schName,
        type: schType,
        value: Number(schValue),
        studentId: schTarget === "student" ? schTargetId : undefined,
        familyGroupId: schTarget === "family" ? schTargetId : undefined,
        startDate: schStartDate,
        endDate: schEndDate || undefined,
        notes: schNotes || undefined,
      };

      const url = editingSch ? `/api/scholarships/${editingSch.id}` : "/api/scholarships";
      const method = editingSch ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(editingSch ? "Scholarship updated" : "Scholarship created");
      setSchOpen(false);
      fetchScholarships();
    } catch {
      toast.error("Failed to save scholarship");
    } finally {
      setSchSubmitting(false);
    }
  }

  // ─── Pricing Rule CRUD ───────────────────────────────────────────────

  function openAddRule() {
    setEditingRule(null);
    setRuleName("");
    setRuleTrigger("2");
    setRuleDiscountType("PERCENT_OFF");
    setRuleValue("");
    setRuleGlobal(true);
    setRuleFamilyId("");
    setRuleOpen(true);
  }

  function openEditRule(r: PricingRule) {
    setEditingRule(r);
    setRuleName(r.name);
    setRuleTrigger(String(r.triggerCount));
    setRuleDiscountType(r.discountType as "PERCENT_OFF" | "FIXED_PRICE" | "FAMILY_CAP");
    setRuleValue(String(r.discountValue));
    setRuleGlobal(r.isGlobal);
    setRuleFamilyId(r.familyGroup?.id || "");
    setRuleOpen(true);
  }

  async function onSubmitRule() {
    setRuleSubmitting(true);
    try {
      const body = {
        name: ruleName,
        triggerCount: Number(ruleTrigger),
        discountType: ruleDiscountType,
        discountValue: Number(ruleValue),
        isGlobal: ruleGlobal,
        familyGroupId: ruleGlobal ? undefined : ruleFamilyId || undefined,
      };

      const url = editingRule ? `/api/pricing-rules/${editingRule.id}` : "/api/pricing-rules";
      const method = editingRule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(editingRule ? "Rule updated" : "Rule created");
      setRuleOpen(false);
      fetchPricingRules();
    } catch {
      toast.error("Failed to save pricing rule");
    } finally {
      setRuleSubmitting(false);
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────

  async function onDelete() {
    if (!deleteConfirm) return;
    try {
      const url =
        deleteConfirm.type === "scholarship"
          ? `/api/scholarships/${deleteConfirm.id}`
          : `/api/pricing-rules/${deleteConfirm.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted successfully");
      setDeleteConfirm(null);
      if (deleteConfirm.type === "scholarship") fetchScholarships();
      else fetchPricingRules();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const schColumns: ColumnDef<ScholarshipRow>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => {
          const s = row.original;
          if (s.type === "PERCENT") return `${s.value}%`;
          if (s.type === "WAIVER") return "Full waiver";
          return formatCurrency(s.value);
        },
      },
      {
        accessorKey: "recipient",
        header: "Recipient",
        cell: ({ row }) => {
          const s = row.original;
          return s.familyGroup?.name || (s.student ? `${s.student.firstName} ${s.student.lastName}` : "-");
        },
      },
      {
        accessorKey: "dates",
        header: "Dates",
        cell: ({ row }) => (
          <span className="text-sm">
            {formatDate(row.original.startDate)}
            {row.original.endDate ? ` – ${formatDate(row.original.endDate)}` : " – ongoing"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEditScholarship(row.original)}>
              <Pencil className="h-4 w-4" aria-hidden />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm({ type: "scholarship", id: row.original.id })}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Scholarships & Pricing" description="Manage scholarships and pricing rules">
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAddRule}>
            <Settings className="h-4 w-4 mr-2" />
            Add Pricing Rule
          </Button>
          <Button onClick={openAddScholarship}>
            <Plus className="h-4 w-4 mr-2" />
            Add Scholarship
          </Button>
        </div>
      </PageHeader>

      {/* Pricing Rules Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {pricingRules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pricing rules configured.</p>
          ) : (
            <div className="divide-y">
              {pricingRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.discountType === "PERCENT_OFF" && `${rule.discountValue}% off`}
                      {rule.discountType === "FIXED_PRICE" && `Fixed price: ${formatCurrency(rule.discountValue)}`}
                      {rule.discountType === "FAMILY_CAP" && `Family cap: ${formatCurrency(rule.discountValue)}`}
                      {" "}starting from enrollment #{rule.triggerCount}
                      {rule.isGlobal ? " (Global)" : rule.familyGroup ? ` (${rule.familyGroup.name})` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditRule(rule)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm({ type: "rule", id: rule.id })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scholarships Table */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Scholarships</h2>
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="pt-6">
            <DataTable
              columns={schColumns}
              data={scholarships}
              pageCount={totalPages}
              page={page}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>

      {/* Scholarship Modal */}
      <Modal
        open={schOpen}
        onClose={() => setSchOpen(false)}
        title={editingSch ? "Edit Scholarship" : "Add Scholarship"}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={schName} onChange={(e) => setSchName(e.target.value)} placeholder="e.g. Merit Scholarship" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <StyledSelect
                value={schType}
                onChange={(value) => setSchType(value as "PERCENT" | "FIXED" | "WAIVER")}
                options={[
                  { value: "PERCENT", label: "Percentage" },
                  { value: "FIXED", label: "Fixed Amount" },
                  { value: "WAIVER", label: "Full Waiver" },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label>{schType === "PERCENT" ? "Percentage" : schType === "FIXED" ? "Amount (cents)" : "Value"}</Label>
              <Input
                type="number"
                value={schValue}
                onChange={(e) => setSchValue(e.target.value)}
                disabled={schType === "WAIVER"}
                placeholder={schType === "PERCENT" ? "e.g. 50" : "e.g. 5000"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Apply To</Label>
              <StyledSelect
                value={schTarget}
                onChange={(value) => {
                  setSchTarget(value as "student" | "family");
                  setSchTargetId("");
                }}
                options={[
                  { value: "student", label: "Student" },
                  { value: "family", label: "Family Group" },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label>{schTarget === "student" ? "Student" : "Family"}</Label>
              <StyledSelect
                value={schTargetId}
                onChange={(value) => setSchTargetId(value)}
                placeholder="Select..."
                options={
                  schTarget === "student"
                    ? students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))
                    : families.map((f) => ({ value: f.id, label: f.name }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <input
                type="date"
                value={schStartDate}
                onChange={(e) => setSchStartDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="grid gap-2">
              <Label>End Date (optional)</Label>
              <input
                type="date"
                value={schEndDate}
                onChange={(e) => setSchEndDate(e.target.value)}
                className="flex h-9 rounded-full border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setSchOpen(false)}>Cancel</Button>
            <Button onClick={onSubmitScholarship} disabled={schSubmitting}>
              {schSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSch ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pricing Rule Modal */}
      <Modal
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        title={editingRule ? "Edit Pricing Rule" : "Add Pricing Rule"}
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Sibling Discount" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Discount Type</Label>
              <StyledSelect
                value={ruleDiscountType}
                onChange={(value) => setRuleDiscountType(value as "PERCENT_OFF" | "FIXED_PRICE" | "FAMILY_CAP")}
                options={[
                  { value: "PERCENT_OFF", label: "Percentage Off" },
                  { value: "FIXED_PRICE", label: "Fixed Price" },
                  { value: "FAMILY_CAP", label: "Family Cap" },
                ]}
              />
            </div>
            <div className="grid gap-2">
              <Label>
                {ruleDiscountType === "PERCENT_OFF" ? "Percentage" : "Amount (cents)"}
              </Label>
              <Input
                type="number"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder={ruleDiscountType === "PERCENT_OFF" ? "e.g. 50" : "e.g. 5000"}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Trigger at enrollment #</Label>
            <Input
              type="number"
              min={2}
              value={ruleTrigger}
              onChange={(e) => setRuleTrigger(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Discount applies starting from the Nth enrollment</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ruleGlobal}
              onChange={(e) => setRuleGlobal(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Global (applies to all families)</span>
          </label>
          {!ruleGlobal && (
            <div className="grid gap-2">
              <Label>Family Group</Label>
              <StyledSelect
                value={ruleFamilyId}
                onChange={(value) => setRuleFamilyId(value)}
                placeholder="Select..."
                options={families.map((f) => ({ value: f.id, label: f.name }))}
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={onSubmitRule} disabled={ruleSubmitting}>
              {ruleSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
        description="Are you sure? This action cannot be undone."
        className="max-w-sm"
      >
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
