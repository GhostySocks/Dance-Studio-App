"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TeacherPaymentRecord } from "@/lib/db/teacher-payments";
import type { PayBasis } from "@/lib/teacher-report";

const formSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount, such as 480 or 480.50")
    .refine((text) => Number(text) > 0, "Enter an amount above zero"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was paid"),
  reference: z.string().trim().max(60, "Keep it under 60 characters"),
  note: z.string().trim().max(300, "Keep it under 300 characters"),
});

type FormValues = z.infer<typeof formSchema>;

/**
 * Records that a teacher was paid for a period (by check or otherwise, outside
 * the app). `onRecorded` receives the saved payment.
 */
export function TeacherPaymentForm({
  teacherId,
  start,
  end,
  owedCents,
  basis,
  rateCents,
  today,
  onRecorded,
  onCancel,
}: {
  teacherId: string;
  start: string;
  end: string;
  /** The pay worked out from the rate, used to fill in the amount (0 = no rate entered) */
  owedCents: number;
  basis: PayBasis;
  rateCents: number;
  today: string;
  onRecorded: (payment: TeacherPaymentRecord) => void;
  onCancel: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: owedCents > 0 ? (owedCents / 100).toFixed(2) : "",
      paidOn: today,
      reference: "",
      note: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      const amountCents = Math.round(Number(values.amount) * 100);
      // The rate is only kept when the amount is the one it works out to
      const usedRate = owedCents > 0 && amountCents === owedCents;
      const res = await fetch(`/api/teachers/${teacherId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start,
          end,
          amountCents,
          ...(usedRate ? { basis, rateCents } : {}),
          paidOn: values.paidOn,
          reference: values.reference || undefined,
          note: values.note || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Could not record the payment");
      toast.success("Payment recorded");
      onRecorded(json.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not record the payment");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <RequiredNote />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="payment-amount">
            Amount paid ($)
            <RequiredMark />
          </Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            placeholder="e.g. 480.00"
            aria-required="true"
            aria-invalid={errors.amount ? "true" : undefined}
            {...register("amount")}
          />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payment-date">
            Paid on
            <RequiredMark />
          </Label>
          <Input
            id="payment-date"
            type="date"
            aria-required="true"
            aria-invalid={errors.paidOn ? "true" : undefined}
            {...register("paidOn")}
          />
          {errors.paidOn && <p className="text-xs text-destructive">{errors.paidOn.message}</p>}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-reference">Check number or reference (optional)</Label>
        <Input id="payment-reference" placeholder="e.g. Check 1042" maxLength={60} {...register("reference")} />
        {errors.reference && <p className="text-xs text-destructive">{errors.reference.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="payment-note">Note (optional)</Label>
        <Input id="payment-note" maxLength={300} {...register("note")} />
        {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        This only keeps a record. No money is sent through the app.
      </p>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Record payment
        </Button>
      </div>
    </form>
  );
}
