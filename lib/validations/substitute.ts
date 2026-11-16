import { z } from "zod";

export const substituteSchema = z.object({
  teacherId: z.string().min(1, "Choose the substitute teacher"),
  reason: z.string().trim().max(200, "Keep the reason under 200 characters").optional(),
});

export type SubstituteFormData = z.infer<typeof substituteSchema>;
