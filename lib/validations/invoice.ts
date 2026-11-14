import { z } from "zod";

export const generateInvoiceSchema = z.object({
  familyGroupId: z.string().optional(),
  studentId: z.string().optional(),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
}).refine(
  (data) => data.familyGroupId || data.studentId,
  { message: "Either familyGroupId or studentId is required" }
);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");

export const generateAllInvoicesSchema = z
  .object({ periodStart: day, periodEnd: day })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "The period must end on or after the day it starts",
    path: ["periodEnd"],
  });

/** Send chosen draft invoices, or every draft when no ids are given. */
export const sendInvoicesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500).optional(),
});

/**
 * A line an admin adds to a draft invoice by hand: a charge (a costume fee, a
 * late fee) or a discount, the latter as an amount or a percentage of the charges.
 */
export const invoiceLineItemSchema = z
  .object({
    kind: z.enum(["CHARGE", "DISCOUNT"]),
    description: z.string().trim().min(1, "Enter a description").max(120, "Keep it under 120 characters"),
    amountCents: z.number().int().min(1, "Enter an amount above zero").max(10_000_000).optional(),
    percent: z.number().gt(0, "Enter a percentage above zero").max(100, "Cannot be more than 100%").optional(),
  })
  .refine((data) => data.kind !== "CHARGE" || (data.amountCents !== undefined && data.percent === undefined), {
    message: "Enter an amount",
    path: ["amountCents"],
  })
  .refine(
    (data) => data.kind !== "DISCOUNT" || (data.amountCents !== undefined) !== (data.percent !== undefined),
    { message: "Enter an amount or a percentage", path: ["amountCents"] }
  );

export const invoiceStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "VOID"]),
});

export const scholarshipSchema = z.object({
  name: z.string().min(1, "Name is required"),
  studentId: z.string().optional(),
  familyGroupId: z.string().optional(),
  type: z.enum(["PERCENT", "FIXED", "WAIVER"]),
  value: z.coerce.number().min(0, "Value must be non-negative"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export const pricingRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  familyGroupId: z.string().optional(),
  triggerCount: z.coerce.number().int().min(2, "Must be at least 2"),
  discountType: z.enum(["PERCENT_OFF", "FIXED_PRICE", "FAMILY_CAP"]),
  discountValue: z.coerce.number().min(0, "Value must be non-negative"),
  isGlobal: z.boolean().optional().default(false),
});

export type GenerateInvoiceFormData = z.infer<typeof generateInvoiceSchema>;
export type ScholarshipFormData = z.infer<typeof scholarshipSchema>;
export type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;
