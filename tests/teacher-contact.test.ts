import { describe, expect, it } from "vitest";

import { TEACHER_CONTACT_DAYS, withinTeacherContactWindow } from "@/lib/teacher-contact";
import { removeTeacherSchema } from "@/lib/validations/staff";
import { teacherMessageFormSchema, teacherMessageSchema } from "@/lib/validations/teacher-message";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-11T15:00:00Z");

describe("withinTeacherContactWindow", () => {
  it("includes upcoming classes and recent ones", () => {
    expect(withinTeacherContactWindow(new Date(now.getTime() + 60 * DAY), now)).toBe(true);
    expect(withinTeacherContactWindow(new Date(now.getTime() - 1 * DAY), now)).toBe(true);
    expect(withinTeacherContactWindow(new Date(now.getTime() - (TEACHER_CONTACT_DAYS - 1) * DAY), now)).toBe(true);
  });

  it("excludes classes that finished long ago", () => {
    expect(withinTeacherContactWindow(new Date(now.getTime() - (TEACHER_CONTACT_DAYS + 1) * DAY), now)).toBe(false);
    expect(withinTeacherContactWindow("2026-03-16T16:00:00Z", now)).toBe(false);
  });
});

describe("teacher message validation", () => {
  const ok = { subject: "Question about Ballet", message: "What shoes does Emma need?" };

  it("accepts a normal message and trims it", () => {
    const parsed = teacherMessageFormSchema.parse({ subject: "  Hi there  ", message: "  A real question here.  " });
    expect(parsed).toEqual({ subject: "Hi there", message: "A real question here." });
  });

  it("rejects empty, tiny and oversized messages", () => {
    expect(teacherMessageFormSchema.safeParse({ ...ok, subject: "  " }).success).toBe(false);
    expect(teacherMessageFormSchema.safeParse({ ...ok, message: "hi" }).success).toBe(false);
    expect(teacherMessageFormSchema.safeParse({ ...ok, message: "x".repeat(2001) }).success).toBe(false);
    expect(teacherMessageFormSchema.safeParse({ ...ok, subject: "x".repeat(121) }).success).toBe(false);
  });

  it("needs a teacher, and carries nothing else from the request", () => {
    expect(teacherMessageSchema.safeParse(ok).success).toBe(false);
    const parsed = teacherMessageSchema.parse({ ...ok, teacherId: "t1", to: "someone@else.com", replyTo: "x@y.z" });
    expect(Object.keys(parsed).sort()).toEqual(["message", "subject", "teacherId"]);
  });
});

describe("removeTeacherSchema", () => {
  it("allows removing with or without a teacher to take over", () => {
    expect(removeTeacherSchema.parse({})).toEqual({});
    expect(removeTeacherSchema.parse({ reassignTo: null })).toEqual({ reassignTo: null });
    expect(removeTeacherSchema.parse({ reassignTo: "t2" })).toEqual({ reassignTo: "t2" });
    expect(removeTeacherSchema.safeParse({ reassignTo: "" }).success).toBe(false);
  });
});
