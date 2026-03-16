import { z } from "zod";

export const teacherSchema = z.object({
  bio: z.string().nullable().optional().or(z.literal("")),
  specialties: z.array(z.string()).optional().default([]),
  phone: z.string().max(20).nullable().optional().or(z.literal("")),
});

export type TeacherFormData = z.input<typeof teacherSchema>;
