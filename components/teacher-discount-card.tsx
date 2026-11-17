"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeacherDiscount } from "@/lib/teacher-discount";

/** The form as typed: a percentage, or dollars for an amount off. */
const formSchema = z
  .object({
    type: z.enum(["NONE", "PERCENT", "FIXED"]),
    amount: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "NONE") return;
    const value = Number(data.amount);
    const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["amount"], message });
    if (data.amount === "" || !Number.isFinite(value)) return issue("Enter a value");
    if (data.type === "PERCENT") {
      if (!Number.isInteger(value) || value < 1 || value > 100) issue("Use a whole number from 1 to 100");
    } else if (Math.round(value * 100) < 1) {
      issue("Enter an amount above zero");
    }
  });
type FormData = z.infer<typeof formSchema>;

const toForm = (discount: TeacherDiscount | null): FormData =>
  discount
    ? { type: discount.type, amount: discount.type === "FIXED" ? (discount.value / 100).toFixed(2) : String(discount.value) }
    : { type: "NONE", amount: "" };

/**
 * Settings: the discount teachers get on classes they take themselves, as a
 * percentage or a dollar amount. It is applied when their invoices are generated.
 */
export function TeacherDiscountCard() {
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, watch, formState } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "NONE", amount: "" },
  });
  const { errors, isSubmitting, isDirty } = formState;
  const type = watch("type");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/studio/teacher-discount");
        if (!res.ok) throw new Error("Failed");
        reset(toForm((await res.json()).data.discount));
      } catch {
        toast.error("Could not load the teacher discount");
      } finally {
        setLoading(false);
      }
    })();
  }, [reset]);

  async function onSubmit(values: FormData) {
    const body =
      values.type === "NONE"
        ? { type: "NONE" }
        : values.type === "PERCENT"
          ? { type: "PERCENT", value: Number(values.amount) }
          : { type: "FIXED", value: Math.round(Number(values.amount) * 100) };
    try {
      const res = await fetch("/api/studio/teacher-discount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(typeof json?.error === "string" ? json.error : "Could not save the teacher discount");
        return;
      }
      reset(toForm(json.data.discount));
      toast.success(json.data.discount ? "Teacher discount saved" : "Teacher discount turned off", {
        description: "It applies to invoices generated from now on.",
      });
    } catch {
      toast.error("Could not save the teacher discount. Please try again.");
    }
  }

  const selectClass =
    "h-8 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <Card className="rounded-2xl border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Teacher discount</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          What teachers get off the classes they take as students. Set 100% to make their classes free.
          A teacher is set up to take classes from their page under Teachers.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <RequiredNote />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-discount-type">
                Discount
                <RequiredMark />
              </Label>
              <select
                id="teacher-discount-type"
                aria-required="true"
                disabled={loading}
                className={selectClass}
                {...register("type")}
              >
                <option value="NONE">No discount</option>
                <option value="PERCENT">Percentage off (%)</option>
                <option value="FIXED">Dollar amount off ($)</option>
              </select>
            </div>
            {type !== "NONE" && (
              <div className="space-y-2">
                <Label htmlFor="teacher-discount-amount">
                  {type === "PERCENT" ? "Percent off" : "Amount off ($)"}
                  <RequiredMark />
                </Label>
                <Input
                  id="teacher-discount-amount"
                  type="number"
                  inputMode="decimal"
                  min={type === "PERCENT" ? 1 : 0.01}
                  max={type === "PERCENT" ? 100 : undefined}
                  step={type === "PERCENT" ? 1 : 0.01}
                  placeholder={type === "PERCENT" ? "e.g. 100" : "e.g. 20.00"}
                  aria-required="true"
                  aria-invalid={!!errors.amount}
                  aria-describedby={errors.amount ? "teacher-discount-amount-error" : "teacher-discount-amount-hint"}
                  {...register("amount")}
                />
                {errors.amount ? (
                  <p id="teacher-discount-amount-error" className="text-sm text-destructive">
                    {errors.amount.message}
                  </p>
                ) : (
                  <p id="teacher-discount-amount-hint" className="text-sm text-muted-foreground">
                    {type === "PERCENT"
                      ? "Taken off everything on the teacher's invoice."
                      : "Taken off each invoice, never more than the invoice total."}
                  </p>
                )}
              </div>
            )}
          </div>
          <Button type="submit" disabled={loading || isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {isSubmitting ? "Saving…" : "Save teacher discount"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
