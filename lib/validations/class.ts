import { z } from "zod";

export const classTemplateSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100),
  description: z.string().nullable().optional().or(z.literal("")),
  danceStyle: z.string().nullable().optional().or(z.literal("")),
  skillLevel: z.string().nullable().optional().or(z.literal("")),
  defaultDurationMins: z.coerce.number().int().min(1, "Duration must be at least 1 minute"),
  basePriceCents: z.coerce.number().int().min(0, "Price cannot be negative"),
});

export type ClassTemplateFormData = z.input<typeof classTemplateSchema>;

export const classSessionSchema = z.object({
  templateId: z.string().min(1, "Class template is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  roomId: z.string().min(1, "Room is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  maxCapacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  notes: z.string().nullable().optional().or(z.literal("")),
  isRecurring: z.boolean().optional().default(false),
  weekCount: z.coerce.number().int().min(1).max(52).optional().default(1),
});

export type ClassSessionFormData = z.input<typeof classSessionSchema>;
