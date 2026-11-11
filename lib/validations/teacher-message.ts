import { z } from "zod";

/** What the person types. */
export const teacherMessageFormSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(120, "Keep the subject under 120 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Please write a little more")
    .max(2000, "Keep the message under 2,000 characters"),
});

export const teacherMessageSchema = teacherMessageFormSchema.extend({
  teacherId: z.string().min(1).max(64),
});

export type TeacherMessageFormData = z.infer<typeof teacherMessageFormSchema>;
