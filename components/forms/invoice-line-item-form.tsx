"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { RequiredMark, RequiredNote } from "@/components/required-mark";
import { StyledSelect } from "@/components/styled-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z
  .object({
    kind: z.enum(["CHARGE", "DISCOUNT"]),
    unit: z.enum(["AMOUNT", "PERCENT"]),
    description: z.string().trim().min(1, "Enter a description").max(120, "Keep it under 120 characters"),
    value: z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a number, such as 25 or 12.50")
      .refine((text) => Number(text) > 0, "Enter a number above zero"),
  })
  .refine((data) => !(data.kind === "DISCOUNT" && data.unit === "PERCENT") || Number(data.value) <= 100, {
    message: "Cannot be more than 100%",
    path: ["value"],
  });

type FormValues = z.infer<typeof formSchema>;

const DEFAULTS: FormValues = { kind: "CHARGE", unit: "AMOUNT", description: "", value: "" };

/**
 * Adds a charge (costume fee, late fee) or a discount to a draft invoice.
 * `onAdded` receives the updated invoice.
 */
export function InvoiceLineItemForm<T>({
  invoiceId,
  onAdded,
}: {
  invoiceId: string;
  onAdded: (invoice: T) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULTS });

  const kind = watch("kind");
  const unit = watch("unit");
  const isPercent = kind === "DISCOUNT" && unit === "PERCENT";

  async function onSubmit(values: FormValues) {
    setIsSaving(true);
    try {
      const percent = values.kind === "DISCOUNT" && values.unit === "PERCENT";
      const res = await fetch(`/api/invoices/${invoiceId}/line-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: values.kind,
          description: values.description,
          ...(percent
            ? { percent: Number(values.value) }
            : { amountCents: Math.round(Number(values.value) * 100) }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Could not add the line");
      toast.success(values.kind === "CHARGE" ? "Charge added" : "Discount added");
      reset({ ...DEFAULTS, kind: values.kind, unit: values.unit });
      onAdded(json.data as T);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not add the line");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border bg-muted/40 p-4" noValidate>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Add a charge or discount</h3>
        <RequiredNote />
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="grid gap-1.5">
          <Label id="line-kind-label">
            Type
            <RequiredMark />
          </Label>
          <StyledSelect
            value={kind}
            onChange={(val) => setValue("kind", val as FormValues["kind"])}
            options={[
              { value: "CHARGE", label: "Charge" },
              { value: "DISCOUNT", label: "Discount" },
            ]}
            placeholder="Select..."
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="line-description">
            Description
            <RequiredMark />
          </Label>
          <Input
            id="line-description"
            aria-required="true"
            aria-invalid={!!errors.description}
            placeholder={kind === "CHARGE" ? "Recital costume fee" : "Early payment discount"}
            {...register("description")}
          />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {kind === "DISCOUNT" && (
          <div className="grid w-40 gap-1.5">
            <Label>
              Discount as
              <RequiredMark />
            </Label>
            <StyledSelect
              value={unit}
              onChange={(val) => setValue("unit", val as FormValues["unit"])}
              options={[
                { value: "AMOUNT", label: "Amount ($)" },
                { value: "PERCENT", label: "Percent (%)" },
              ]}
              placeholder="Select..."
            />
          </div>
        )}
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="line-value">
            {isPercent ? "Percent off" : "Amount ($)"}
            <RequiredMark />
          </Label>
          <Input
            id="line-value"
            inputMode="decimal"
            aria-required="true"
            aria-invalid={!!errors.value}
            placeholder={isPercent ? "10" : "25.00"}
            {...register("value")}
          />
        </div>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-2 h-4 w-4" aria-hidden />
          )}
          Add
        </Button>
      </div>
      {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
      {isPercent && (
        <p className="text-xs text-muted-foreground">
          The percentage is taken from the charges on this invoice as they are now.
        </p>
      )}
    </form>
  );
}
