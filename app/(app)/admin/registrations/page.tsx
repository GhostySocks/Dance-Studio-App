"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { DataTable } from "@/components/data-table";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS, PLAN_UNITS, TERM_PLANS, type BillingPlan } from "@/lib/registration-billing";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Registration {
  id: string;
  plan: BillingPlan;
  priceCents: number;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
  covers: string;
  dates: number;
  waitlisted: number;
  student: { id: string; firstName: string; lastName: string };
  template: { id: string; name: string };
}

interface Option {
  id: string;
  label: string;
}

interface ClassOption extends Option {
  prices: { plan: string; priceCents: number }[];
}

interface TermOption extends Option {
  hasSeason: boolean;
}

const formSchema = z.object({
  studentId: z.string().min(1, "Choose a student"),
  templateId: z.string().min(1, "Choose a class"),
  termId: z.string().min(1, "Choose a term"),
  plan: z.enum(TERM_PLANS, { message: "Choose a billing option" }),
});
type FormData = z.infer<typeof formSchema>;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

async function readError(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  return typeof json?.error === "string" ? json.error : fallback;
}

function NewRegistrationForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [students, setStudents] = useState<Option[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, watch, formState } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { studentId: "", templateId: "", termId: "" },
  });
  const { errors, isSubmitting } = formState;
  const templateId = watch("templateId");
  const termId = watch("termId");

  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, classesRes, termsRes] = await Promise.all([
          fetch("/api/students?perPage=500"),
          fetch("/api/classes?perPage=200"),
          fetch("/api/terms"),
        ]);
        if (!studentsRes.ok || !classesRes.ok || !termsRes.ok) throw new Error("Failed");
        const [s, c, t] = await Promise.all([studentsRes.json(), classesRes.json(), termsRes.json()]);
        setStudents(
          s.data.students.map((x: { id: string; firstName: string; lastName: string }) => ({
            id: x.id,
            label: `${x.lastName}, ${x.firstName}`,
          }))
        );
        setClasses(
          c.data.templates.map((x: { id: string; name: string; prices?: ClassOption["prices"] }) => ({
            id: x.id,
            label: x.name,
            prices: x.prices ?? [],
          }))
        );
        setTerms(
          t.data.terms.map((x: { id: string; name: string; seasonId: string | null }) => ({
            id: x.id,
            label: x.name,
            hasSeason: !!x.seasonId,
          }))
        );
      } catch {
        toast.error("Failed to load students, classes and terms");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const plans = useMemo(() => {
    const cls = classes.find((c) => c.id === templateId);
    const term = terms.find((t) => t.id === termId);
    if (!cls) return [];
    return cls.prices.filter((p) => p.plan !== "ANNUAL" || term?.hasSeason);
  }, [classes, terms, templateId, termId]);

  async function onSubmit(values: FormData) {
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [values.studentId],
          templateId: values.templateId,
          termId: values.termId,
          plan: values.plan,
        }),
      });
      const json = await res.json().catch(() => null);
      const result = Array.isArray(json?.data) ? json.data[0] : null;
      if (!result) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not register");
        return;
      }
      if (!result.success) {
        toast.error(result.error ?? "Could not register");
        return;
      }
      toast.success(
        `${result.name}: ${result.enrolled} class${result.enrolled === 1 ? "" : "es"} booked` +
          (result.waitlisted > 0 ? `, ${result.waitlisted} waitlisted` : "")
      );
      onDone();
    } catch {
      toast.error("Could not register. Please try again.");
    }
  }

  if (loading) return <Skeleton className="h-56 rounded-xl" />;

  const field = (
    name: keyof FormData,
    label: string,
    options: { value: string; label: string }[],
    emptyLabel: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`reg-${name}`}>{label}</Label>
      <select
        id={`reg-${name}`}
        className={selectClass}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `reg-${name}-error` : undefined}
        {...register(name)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <p id={`reg-${name}-error`} className="text-sm text-destructive">
          {errors[name]?.message}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {field("studentId", "Student", students.map((s) => ({ value: s.id, label: s.label })), "Select a student")}
      {field("templateId", "Class", classes.map((c) => ({ value: c.id, label: c.label })), "Select a class")}
      {field("termId", "Term", terms.map((t) => ({ value: t.id, label: t.label })), "Select a term")}
      {field(
        "plan",
        "Billing option",
        plans.map((p) => ({
          value: p.plan,
          label: `${PLAN_LABELS[p.plan as BillingPlan]} — ${formatCurrency(p.priceCents)} ${PLAN_UNITS[p.plan as BillingPlan]}`,
        })),
        templateId
          ? plans.length
            ? "Select a billing option"
            : "This class has no term prices set"
          : "Select a class first"
      )}
      <p className="text-sm text-muted-foreground">
        The student is booked into every remaining date of the class in that term. Full dates are
        waitlisted.
      </p>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Registering…" : "Register"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminRegistrationsPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<Registration | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await fetch(`/api/registrations?${params}`);
      if (!res.ok) throw new Error("Failed");
      const { data } = await res.json();
      setRows(data.registrations);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Failed to load registrations");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCancel() {
    if (!cancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/registrations/${cancelling.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(await readError(res, "Could not cancel"));
      } else {
        const { data } = await res.json();
        toast.success(`Registration cancelled. ${data.released} upcoming date${data.released === 1 ? "" : "s"} released.`);
        load();
      }
      setCancelling(null);
    } catch {
      toast.error("Could not cancel. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  const columns = useMemo<ColumnDef<Registration>[]>(
    () => [
      {
        header: "Student",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.student.firstName} {row.original.student.lastName}
          </span>
        ),
      },
      { header: "Class", cell: ({ row }) => row.original.template.name },
      { header: "Covers", cell: ({ row }) => row.original.covers },
      {
        header: "Billing",
        cell: ({ row }) =>
          `${PLAN_LABELS[row.original.plan]} · ${formatCurrency(row.original.priceCents)} ${PLAN_UNITS[row.original.plan]}`,
      },
      {
        header: "Classes",
        cell: ({ row }) =>
          `${row.original.dates}${row.original.waitlisted ? ` (+${row.original.waitlisted} waitlisted)` : ""}`,
      },
      { header: "Registered", cell: ({ row }) => formatDate(row.original.createdAt) },
      {
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "ACTIVE" ? "default" : "outline"}>
            {row.original.status === "ACTIVE" ? "Active" : "Cancelled"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) =>
          row.original.status === "ACTIVE" ? (
            <Button variant="outline" size="sm" onClick={() => setCancelling(row.original)}>
              Cancel
              <span className="sr-only">
                {" "}
                registration for {row.original.student.firstName} {row.original.student.lastName}
              </span>
            </Button>
          ) : null,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Registrations" description="Students registered for a class for a whole term or season">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New registration
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search student or class..."
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <DataTable columns={columns} data={rows} pageCount={totalPages} page={page} onPageChange={setPage} />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New registration"
        description="Register a student for a class for a whole term."
        className="max-w-lg"
      >
        <NewRegistrationForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel registration?"
        description={
          cancelling
            ? `${cancelling.student.firstName} will be removed from the remaining ${cancelling.template.name} dates and will not be charged further instalments. Anything already invoiced stays as it is.`
            : undefined
        }
        className="max-w-md"
      >
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setCancelling(null)} disabled={isCancelling}>
            Keep
          </Button>
          <Button variant="destructive" onClick={onCancel} disabled={isCancelling}>
            {isCancelling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Cancel registration
          </Button>
        </div>
      </Modal>
    </div>
  );
}
