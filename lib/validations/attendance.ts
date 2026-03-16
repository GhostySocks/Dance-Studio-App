import { z } from "zod";

export const markAttendanceSchema = z.object({
  enrollmentId: z.string().min(1, "Enrollment is required"),
  sessionId: z.string().min(1, "Session is required"),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  notes: z.string().optional(),
});

export const batchAttendanceSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
  records: z.array(
    z.object({
      enrollmentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      notes: z.string().optional(),
    })
  ).min(1, "At least one attendance record is required"),
});

export const submitAttendanceSchema = z.object({
  sessionId: z.string().min(1, "Session is required"),
});

export type MarkAttendanceFormData = z.infer<typeof markAttendanceSchema>;
export type BatchAttendanceFormData = z.infer<typeof batchAttendanceSchema>;
