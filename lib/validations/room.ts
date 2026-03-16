import { z } from "zod";

export const roomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100),
  description: z.string().nullable().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
});

export type RoomFormData = z.input<typeof roomSchema>;
