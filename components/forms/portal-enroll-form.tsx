"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { portalEnrollSchema } from "@/lib/validations/registration";
import type { z } from "zod";

type FormData = z.infer<typeof portalEnrollSchema>;

interface EnrollResult {
  name: string;
  success: boolean;
  waitlist: boolean;
  error: string | null;
}

/** Signed-in parents and adult students pick who to enroll in a class. */
export function PortalEnrollForm({
  sessionId,
  students,
  doneHref,
}: {
  sessionId: string;
  students: { id: string; name: string; status: "ACTIVE" | "WAITLIST" | null }[];
  doneHref: string;
}) {
  const router = useRouter();
  const available = students.filter((s) => !s.status);

  const { register, handleSubmit, formState } = useForm<FormData>({
    resolver: zodResolver(portalEnrollSchema),
    defaultValues: {
      sessionId,
      studentIds: available.length === 1 ? [available[0].id] : [],
    },
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: FormData) {
    try {
      const res = await fetch("/api/portal/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => null);
      const results: EnrollResult[] | null = Array.isArray(json?.data) ? json.data : null;

      if (!results) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not enroll");
        return;
      }
      for (const r of results) {
        if (!r.success) toast.error(`${r.name}: ${r.error ?? "could not enroll"}`);
        else if (r.waitlist) toast.success(`${r.name} is on the waitlist.`);
        else toast.success(`${r.name} is enrolled.`);
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
              disabled={!!student.status}
              className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
              {...register("studentIds")}
            />
            <span className="font-medium">{student.name}</span>
            {student.status && (
              <span className="ml-auto text-muted-foreground">
                {student.status === "ACTIVE" ? "Already enrolled" : "On the waitlist"}
              </span>
            )}
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
        {isSubmitting ? "Enrolling…" : "Confirm enrollment"}
      </Button>
    </form>
  );
}
