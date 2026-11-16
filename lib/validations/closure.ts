import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const closureSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name, such as Christmas break").max(80, "Keep it under 80 characters"),
    startDay: day,
    endDay: day,
  })
  .refine((data) => data.endDay >= data.startDay, {
    message: "The last day cannot be before the first day",
    path: ["endDay"],
  })
  .refine(
    (data) => Date.parse(data.endDay) - Date.parse(data.startDay) <= 120 * 24 * 60 * 60 * 1000,
    { message: "A closure can be at most 120 days long", path: ["endDay"] }
  );

export type ClosureFormData = z.infer<typeof closureSchema>;
