import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** A payment made to a teacher for a period of whole studio calendar days. */
export const teacherPaymentSchema = z
  .object({
    start: day,
    end: day,
    amountCents: z.number().int().positive("Enter the amount paid").max(10_000_000, "That amount is too large"),
    basis: z.enum(["PER_CLASS", "PER_HOUR"]).optional(),
    rateCents: z.number().int().positive().max(10_000_000).optional(),
    paidOn: day,
    reference: z.string().trim().max(60, "Keep the reference under 60 characters").optional(),
    note: z.string().trim().max(300, "Keep the note under 300 characters").optional(),
  })
  .refine((data) => data.end >= data.start, { message: "The end date cannot be before the start date" })
  .refine((data) => Date.parse(data.end) - Date.parse(data.start) <= 366 * 24 * 60 * 60 * 1000, {
    message: "Choose a period of a year or less",
  });

export type TeacherPaymentInput = z.infer<typeof teacherPaymentSchema>;
