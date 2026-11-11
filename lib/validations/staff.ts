import { z } from "zod";

const name = z.string().trim().min(1, "Name is required").max(100);
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

/**
 * Splits "Ballet, Jazz" into ["Ballet", "Jazz"], dropping blanks and duplicates
 * (ignoring case, keeping the first spelling).
 */
export function parseSpecialties(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(",")) {
    const value = part.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const profileFields = {
  phone: z.string().trim().max(20, "Phone number is too long"),
  /** Comma-separated in the form; stored as a list. */
  specialties: z.string().max(300, "Too long"),
  bio: z.string().trim().max(2000, "Bio is too long"),
};

/** The teacher profile form (admin edits an existing teacher). */
export const teacherProfileFormSchema = z.object(profileFields);

/** Admin adds a new teacher: an account plus their profile. */
export const newTeacherSchema = z.object({ name, email, ...profileFields });

/** Admin adds another administrator. */
export const newAdminSchema = z.object({ name, email });

/** Removing a teacher: who takes over the classes they were still due to teach. */
export const removeTeacherSchema = z.object({
  reassignTo: z.string().min(1).max(64).nullable().optional(),
});

export type TeacherProfileFormData = z.infer<typeof teacherProfileFormSchema>;
export type NewTeacherFormData = z.infer<typeof newTeacherSchema>;
export type NewAdminFormData = z.infer<typeof newAdminSchema>;
