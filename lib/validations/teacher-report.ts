import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

/** A reporting period of whole studio calendar days, at most a year long. */
export const reportPeriodSchema = z
  .object({ start: day, end: day })
  .refine((data) => data.end >= data.start, { message: "The end date cannot be before the start date" })
  .refine((data) => Date.parse(data.end) - Date.parse(data.start) <= 366 * 24 * 60 * 60 * 1000, {
    message: "Choose a period of a year or less",
  });
