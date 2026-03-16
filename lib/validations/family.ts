import { z } from "zod";

export const familyGroupSchema = z.object({
  name: z.string().min(1, "Family name is required").max(100),
});

export type FamilyGroupFormData = z.input<typeof familyGroupSchema>;
