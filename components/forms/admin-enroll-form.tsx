"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { StyledSelect } from "@/components/styled-select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_LABELS, PLAN_UNITS, type TermPlan } from "@/lib/registration-billing";
import { cn, formatCurrency } from "@/lib/utils";
import { RequiredMark, RequiredNote } from "@/components/required-mark";

interface ClassOption {
  id: string;
  name: string;
  danceStyle: string | null;
  skillLevel: string | null;
}

interface TermOption {
  termId: string;
  termName: string;
  dates: number;
  plans: { plan: TermPlan; priceCents: number; dates: number; covers: string }[];
}

interface SessionOption {
  id: string;
  startTime: string;
  maxCapacity: number;
  enrolled: number;
  teacherName: string;
}

const formSchema = z
  .object({
    templateId: z.string().min(1, "Choose a class"),
    mode: z.enum(["term", "single"]),
    termId: z.string(),
    plan: z.string(),
    sessionId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "term") {
      if (!data.termId) ctx.addIssue({ code: "custom", path: ["termId"], message: "Choose a term" });
      if (!data.plan) ctx.addIssue({ code: "custom", path: ["plan"], message: "Choose a billing option" });
    } else if (!data.sessionId) {
      ctx.addIssue({ code: "custom", path: ["sessionId"], message: "Choose a date" });
    }
  });
type FormData = z.infer<typeof formSchema>;

function sessionLabel(session: SessionOption) {
  const start = new Date(session.startTime);
  const day = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const time = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const full = session.enrolled >= session.maxCapacity ? " · full" : "";
  return `${day}, ${time} — ${session.teacherName} — ${session.enrolled}/${session.maxCapacity}${full}`;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

/**
 * Admin enrolls one student: either in every date of a class for a term (the
 * usual case), or in a single date. Pick the class first; everything else is
 * narrowed to that class so there is never one long list of every date.
 */
export function AdminEnrollForm({
  studentId,
  studentName,
  onDone,
  onCancel,
}: {
  studentId: string;
  studentName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loadingClass, setLoadingClass] = useState(false);

  const { handleSubmit, setValue, watch, formState, clearErrors } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { templateId: "", mode: "term", termId: "", plan: "", sessionId: "" },
  });
  const { errors, isSubmitting } = formState;
  const templateId = watch("templateId");
  const mode = watch("mode");
  const termId = watch("termId");
  const plan = watch("plan");
  const sessionId = watch("sessionId");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/classes?perPage=200");
        if (!res.ok) throw new Error("Failed");
        setClasses((await res.json()).data.templates);
      } catch {
        setClasses([]);
        toast.error("Failed to load classes");
      }
    }
    load();
  }, []);

  async function chooseClass(id: string) {
    setValue("templateId", id);
    setValue("termId", "");
    setValue("plan", "");
    setValue("sessionId", "");
    clearErrors();
    setTerms([]);
    setSessions([]);
    if (!id) return;

    setLoadingClass(true);
    try {
      const res = await fetch(`/api/classes/${id}/registration-options`);
      if (!res.ok) throw new Error("Failed");
      const { data } = await res.json();
      setTerms(data.terms);
      setSessions(data.sessions);
      // Whole term is the usual choice; fall back to single dates when no term is on offer
      setValue("mode", data.terms.length > 0 ? "term" : "single");
      if (data.terms.length === 1) {
        setValue("termId", data.terms[0].termId);
        if (data.terms[0].plans.length === 1) setValue("plan", data.terms[0].plans[0].plan);
      }
    } catch {
      toast.error("Failed to load the options for this class");
    } finally {
      setLoadingClass(false);
    }
  }

  const term = useMemo(() => terms.find((t) => t.termId === termId), [terms, termId]);
  const chosenPlan = term?.plans.find((p) => p.plan === plan);

  async function onSubmit(values: FormData) {
    try {
      if (values.mode === "term") {
        const res = await fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentIds: [studentId],
            templateId: values.templateId,
            termId: values.termId,
            plan: values.plan,
          }),
        });
        const json = await res.json().catch(() => null);
        const result = Array.isArray(json?.data) ? json.data[0] : null;
        if (!result?.success) {
          toast.error(result?.error ?? (typeof json?.error === "string" ? json.error : "Could not register"));
          return;
        }
        toast.success(
          `${studentName} is registered for ${result.enrolled} class${result.enrolled === 1 ? "" : "es"}` +
            (result.waitlisted > 0 ? ` (${result.waitlisted} waitlisted).` : ".")
        );
      } else {
        const res = await fetch("/api/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, sessionId: values.sessionId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(typeof json?.error === "string" ? json.error : "Enrollment failed");
          return;
        }
        if (json.waitlist) toast.info(json.message || "Added to waitlist");
        else toast.success(json.message || "Enrolled successfully");
      }
      onDone();
    } catch {
      toast.error("Could not enroll. Please try again.");
    }
  }

  if (classes === null) return <Skeleton className="h-48 rounded-xl" />;

  const modeButton = (value: FormData["mode"], title: string, hint: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => {
        setValue("mode", value);
        clearErrors();
      }}
      className={cn(
        "rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        mode === value ? "border-primary bg-accent" : "border-border bg-white hover:bg-muted"
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <RequiredNote />
      <div className="space-y-2">
        <label className="block text-sm font-medium">Class<RequiredMark /></label>
        <StyledSelect
          value={templateId}
          onChange={chooseClass}
          placeholder="Choose a class..."
          searchable
          options={classes.map((c) => ({
            value: c.id,
            label: [c.name, c.danceStyle, c.skillLevel].filter(Boolean).join(" · "),
          }))}
        />
        <FieldError message={errors.templateId?.message} />
      </div>

      {templateId && loadingClass && <Skeleton className="h-32 rounded-xl" />}

      {templateId && !loadingClass && (
        <>
          <div>
            <p id="enroll-mode-label" className="text-sm font-medium">
              Enroll {studentName} for
            </p>
            <div
              role="radiogroup"
              aria-labelledby="enroll-mode-label"
              className="mt-2 grid gap-3 sm:grid-cols-2"
            >
              {modeButton(
                "term",
                "The whole term",
                terms.length > 0
                  ? "Every date of this class in a term, billed by plan."
                  : "Not available: this class needs a term with dates and at least one term price.",
                terms.length === 0
              )}
              {modeButton("single", "A single class", "One date, billed at the per-class price.")}
            </div>
          </div>

          {mode === "term" && terms.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Term<RequiredMark /></label>
                <StyledSelect
                  value={termId}
                  onChange={(value) => {
                    setValue("termId", value, { shouldValidate: !!errors.termId });
                    setValue("plan", "");
                  }}
                  placeholder="Choose a term..."
                  options={terms.map((t) => ({
                    value: t.termId,
                    label: `${t.termName} · ${t.dates} class${t.dates === 1 ? "" : "es"} left`,
                  }))}
                />
                <FieldError message={errors.termId?.message} />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Billing option<RequiredMark /></label>
                <StyledSelect
                  value={plan}
                  onChange={(value) => setValue("plan", value, { shouldValidate: !!errors.plan })}
                  placeholder={term ? "Choose a billing option..." : "Choose a term first"}
                  options={(term?.plans ?? []).map((p) => ({
                    value: p.plan,
                    label: `${PLAN_LABELS[p.plan]} — ${formatCurrency(p.priceCents)} ${PLAN_UNITS[p.plan]}`,
                  }))}
                />
                <FieldError message={errors.plan?.message} />
              </div>
              {chosenPlan && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Books the {chosenPlan.dates} remaining class{chosenPlan.dates === 1 ? "" : "es"} in{" "}
                  {chosenPlan.covers}. Any date that is already full is waitlisted.
                </p>
              )}
            </div>
          )}

          {mode === "single" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Date<RequiredMark /></label>
              <StyledSelect
                value={sessionId}
                onChange={(value) => setValue("sessionId", value, { shouldValidate: !!errors.sessionId })}
                placeholder={sessions.length ? "Choose a date..." : "No upcoming dates for this class"}
                searchable={sessions.length > 6}
                options={sessions.map((s) => ({ value: s.id, label: sessionLabel(s) }))}
              />
              <FieldError message={errors.sessionId?.message} />
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !templateId || loadingClass}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? "Enrolling…" : mode === "term" ? "Register for the term" : "Enroll"}
        </Button>
      </div>
    </form>
  );
}
