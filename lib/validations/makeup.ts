import { z } from "zod";

/** Book a makeup: the missed class's attendance record and the class to attend instead. */
export const bookMakeupSchema = z.object({
  attendanceId: z.string().min(1),
  sessionId: z.string().min(1),
});
