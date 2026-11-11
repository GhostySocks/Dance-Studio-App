import { z } from "zod";

import { familyChoiceSchema, guardianChoiceSchema } from "@/lib/validations/household";

export const studentSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: z.string().nullable().optional().transform((val) => val ? new Date(val) : null),
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().max(20).nullable().optional().or(z.literal("")),
  medicalNotes: z.string().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional().or(z.literal("")),
  guardianId: z.string().nullable().optional().or(z.literal("")),
  familyGroupId: z.string().nullable().optional().or(z.literal("")),
  /** Guardian and family chosen on the form; when present these replace the two ids above. */
  guardian: guardianChoiceSchema.optional(),
  family: familyChoiceSchema.optional(),
});

export type StudentFormData = z.input<typeof studentSchema>;
