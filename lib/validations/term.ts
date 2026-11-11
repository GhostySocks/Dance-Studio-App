import { z } from "zod";

import { TERM_PLANS } from "@/lib/registration-billing";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

const range = {
  name: z.string().trim().min(1, "Name is required").max(80),
  startDate: day,
  endDate: day,
};

const endAfterStart = (data: { startDate: string; endDate: string }) => data.endDate >= data.startDate;
const endMessage = { path: ["endDate"], message: "End date must be on or after the start date" };

export const seasonSchema = z.object(range).refine(endAfterStart, endMessage);

export const termSchema = z
  .object({ ...range, seasonId: z.string().max(64) })
  .refine(endAfterStart, endMessage);

export const createRegistrationSchema = z.object({
  studentIds: z.array(z.string().min(1).max(64)).min(1, "Choose at least one dancer").max(8),
  templateId: z.string().min(1).max(64),
  termId: z.string().min(1).max(64),
  plan: z.enum(TERM_PLANS, { message: "Choose a billing option" }),
});

/** The class + term + plan picked on the public site, carried through sign-up. */
export const registrationChoiceSchema = createRegistrationSchema.omit({ studentIds: true });

export type SeasonFormData = z.infer<typeof seasonSchema>;
export type TermFormData = z.infer<typeof termSchema>;
export type CreateRegistrationData = z.infer<typeof createRegistrationSchema>;
