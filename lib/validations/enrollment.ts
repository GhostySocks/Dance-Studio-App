import { z } from "zod";

export const enrollmentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  sessionId: z.string().min(1, "Class session is required"),
  force: z.boolean().optional().default(false),
});

export const enrollmentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "WAITLIST", "CANCELLED"]),
});

export const bulkEnrollSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "At least one student is required"),
  sessionId: z.string().min(1, "Class session is required"),
  force: z.boolean().optional().default(false),
});

export type EnrollmentFormData = z.infer<typeof enrollmentSchema>;
export type EnrollmentStatusFormData = z.infer<typeof enrollmentStatusSchema>;
export type BulkEnrollFormData = z.infer<typeof bulkEnrollSchema>;
