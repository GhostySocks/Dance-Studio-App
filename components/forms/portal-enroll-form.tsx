"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import type { TermPlan } from "@/lib/registration-billing";

const formSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "Choose at least one dancer").max(8),
});
type FormData = z.infer<typeof formSchema>;

/** What is being booked: one class date, or every date of a class in a term. */
export type EnrollTarget =
  | { kind: "session"; sessionId: string }
  | { kind: "term"; templateId: string; termId: string; plan: TermPlan };

interface EnrollResult {
  name: string;
  success: boolean;
  /** Single date: on the waitlist. */
  waitlist?: boolean;
  /** Term: dates booked and dates waitlisted. */
  enrolled?: number;
  waitlisted?: number;
  error: string | null;
}

function describe(result: EnrollResult, target: EnrollTarget): string {
  if (target.kind === "session") {
    return result.waitlist ? `${result.name} is on the waitlist.` : `${result.name} is enrolled.`;
  }
  const booked = result.enrolled ?? 0;
  const waiting = result.waitlisted ?? 0;
  if (booked === 0) return `${result.name} is on the waitlist.`;
  return (
    `${result.name} is registered for ${booked} class${booked === 1 ? "" : "es"}` +
    (waiting > 0 ? ` (${waiting} waitlisted).` : ".")
  );
}

/** Signed-in parents and adult students pick who to enroll. */
export function PortalEnrollForm({
  target,
  students,
  doneHref,
}: {
  target: EnrollTarget;
  /** `taken` explains why a dancer cannot be picked (e.g. "Already enrolled"). */
  students: { id: string; name: string; taken: string | null }[];
  doneHref: string;
}) {
  const router = useRouter();
  const available = students.filter((s) => !s.taken);

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { studentIds: available.length === 1 ? [available[0].id] : [] },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: FormData) {
    const { kind, ...ids } = target;
    try {
      const res = await fetch(kind === "session" ? "/api/portal/enrollments" : "/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: values.studentIds, ...ids }),
      });
      const json = await res.json().catch(() => null);
      const results: EnrollResult[] | null = Array.isArray(json?.data) ? json.data : null;

      if (!results) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not enroll");
        return;
      }
      for (const r of results) {
        if (r.success) toast.success(describe(r, target));
        else toast.error(`${r.name}: ${r.error ?? "could not enroll"}`);
      }
      if (results.some((r) => r.success)) {
        router.push(doneHref);
        router.refresh();
      }
    } catch {
      toast.error("Could not enroll. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">Who is taking this class?</legend>
        {students.map((student) => (
          <label
            key={student.id}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 text-sm has-[:disabled]:opacity-60"
          >
            <input
              type="checkbox"
              value={student.id}
              disabled={!!student.taken}
              className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              {...register("studentIds")}
            />
            <span className="font-medium">{student.name}</span>
            {student.taken && <span className="ml-auto text-muted-foreground">{student.taken}</span>}
          </label>
        ))}
        {errors.studentIds?.message && (
          <p className="text-sm text-destructive">{errors.studentIds.message}</p>
        )}
      </fieldset>

      <Button
        type="submit"
        disabled={isSubmitting || available.length === 0}
        className="h-11 px-6 text-base"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {isSubmitting
          ? "Enrolling…"
          : target.kind === "term"
            ? "Confirm registration"
            : "Confirm enrollment"}
      </Button>
    </form>
  );
}
