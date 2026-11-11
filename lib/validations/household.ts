import { z } from "zod";

/**
 * Who is responsible for a student, chosen on the student form:
 * an existing guardian, a new one entered with their contact details, or nobody
 * (an adult student who looks after their own account).
 */
export const guardianChoiceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), guardianId: z.string().min(1, "Choose a guardian").max(64) }),
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(1, "Guardian name is required").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
    phone: z.string().trim().max(20, "Phone number is too long"),
    address: z.string().trim().max(300, "Address is too long"),
    /** Email them a link to set a password for the parent portal. */
    invite: z.boolean(),
  }),
  z.object({ mode: z.literal("none") }),
]);

/**
 * Which family group the student is billed with: an existing one, a new one made
 * on the spot (the guardian is added to it), or none (billed on their own).
 */
export const familyChoiceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), familyGroupId: z.string().min(1, "Choose a family group").max(64) }),
  z.object({ mode: z.literal("new"), name: z.string().trim().min(1, "Family group name is required").max(100) }),
  z.object({ mode: z.literal("none") }),
]);

export type GuardianChoice = z.infer<typeof guardianChoiceSchema>;
export type FamilyChoice = z.infer<typeof familyChoiceSchema>;
