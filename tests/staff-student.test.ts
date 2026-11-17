import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeTeacher {
  id: string;
  removedAt: Date | null;
  phone: string | null;
  user: { id: string; name: string | null; email: string; disabledAt: Date | null };
}
interface FakeStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  userId: string;
}

const state = vi.hoisted(() => ({
  teachers: [] as FakeTeacher[],
  students: [] as FakeStudent[],
  audit: [] as { action: string; meta: Record<string, unknown> }[],
}));

const db = vi.hoisted(() => {
  const tx = {
    teacher: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const teacher = state.teachers.find(
          (t) => t.id === where.id && t.removedAt === null && t.user.disabledAt === null
        );
        if (!teacher) return null;
        const student = state.students.find((s) => s.userId === teacher.user.id);
        return { ...teacher, user: { ...teacher.user, student: student ? { id: student.id } : null } };
      }),
    },
    student: {
      create: vi.fn(async ({ data }: { data: Omit<FakeStudent, "id"> }) => {
        const row = { id: `stu-${state.students.length + 1}`, ...data };
        state.students.push(row);
        return { id: row.id };
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; meta: Record<string, unknown> } }) => {
        state.audit.push(data);
      }),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { addStudentProfile, splitName } from "@/lib/db/staff";
import { isPortalUser } from "@/lib/permissions";
import { teacherDiscountCents, teacherDiscountLabel, toTeacherDiscount } from "@/lib/teacher-discount";
import { teacherDiscountSchema } from "@/lib/validations/staff";

beforeEach(() => {
  vi.clearAllMocks();
  state.audit = [];
  state.students = [];
  state.teachers = [
    {
      id: "t-maria",
      removedAt: null,
      phone: "555-0101",
      user: { id: "maria", name: "Maria Elena Garcia", email: "maria@test.com", disabledAt: null },
    },
    {
      id: "t-gone",
      removedAt: new Date(),
      phone: null,
      user: { id: "gone", name: "Gone Teacher", email: "gone@test.com", disabledAt: null },
    },
  ];
});

describe("a teacher who takes classes", () => {
  it("gets their own student record on the same account", async () => {
    const result = await addStudentProfile("t-maria", "admin");
    expect(result).toEqual({ userId: "maria", studentId: "stu-1", created: true });
    expect(state.students[0]).toMatchObject({
      firstName: "Maria Elena",
      lastName: "Garcia",
      email: "maria@test.com",
      phone: "555-0101",
      userId: "maria",
    });
    expect(state.audit[0]).toMatchObject({ action: "STAFF_STUDENT_PROFILE_ADDED", meta: { teacherId: "t-maria" } });
  });

  it("keeps the one record when set up again", async () => {
    await addStudentProfile("t-maria", "admin");
    const again = await addStudentProfile("t-maria", "admin");
    expect(again).toEqual({ userId: "maria", studentId: "stu-1", created: false });
    expect(state.students).toHaveLength(1);
  });

  it("is refused for someone who is no longer a teacher", async () => {
    await expect(addStudentProfile("t-gone", "admin")).resolves.toBeNull();
    expect(state.students).toHaveLength(0);
  });

  it("splits a name into first and last", () => {
    expect(splitName("James Wilson")).toEqual({ firstName: "James", lastName: "Wilson" });
    expect(splitName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

describe("who may use the student pages and portal endpoints", () => {
  const session = (role: "ADMIN" | "TEACHER" | "PARENT" | "STUDENT", takesClasses = false) => ({
    user: { role, takesClasses },
  });

  it("lets in parents, adult students and staff who take classes", () => {
    expect(isPortalUser(session("PARENT"))).toBe(true);
    expect(isPortalUser(session("STUDENT"))).toBe(true);
    expect(isPortalUser(session("TEACHER", true))).toBe(true);
    expect(isPortalUser(session("ADMIN", true))).toBe(true);
  });

  it("keeps out teachers who do not take classes, and anyone signed out", () => {
    expect(isPortalUser(session("TEACHER"))).toBe(false);
    expect(isPortalUser(null)).toBe(false);
  });
});

describe("the teacher discount setting", () => {
  it("reads what is stored, treating anything incomplete as no discount", () => {
    expect(toTeacherDiscount("PERCENT", 50)).toEqual({ type: "PERCENT", value: 50 });
    expect(toTeacherDiscount("FIXED", 2000)).toEqual({ type: "FIXED", value: 2000 });
    expect(toTeacherDiscount(null, null)).toBeNull();
    expect(toTeacherDiscount("PERCENT", null)).toBeNull();
    expect(toTeacherDiscount("PERCENT", 150)).toBeNull();
    expect(toTeacherDiscount("WEEKLY", 10)).toBeNull();
  });

  it("works out the amount off, never more than the total", () => {
    expect(teacherDiscountCents({ type: "PERCENT", value: 25 }, 9000)).toBe(2250);
    expect(teacherDiscountCents({ type: "PERCENT", value: 100 }, 9000)).toBe(9000);
    expect(teacherDiscountCents({ type: "FIXED", value: 2000 }, 9000)).toBe(2000);
    expect(teacherDiscountCents({ type: "FIXED", value: 2000 }, 1500)).toBe(1500);
    expect(teacherDiscountCents({ type: "PERCENT", value: 50 }, 0)).toBe(0);
  });

  it("is named on the invoice line", () => {
    expect(teacherDiscountLabel({ type: "PERCENT", value: 50 })).toBe("Teacher discount (50%)");
    expect(teacherDiscountLabel({ type: "FIXED", value: 2000 })).toBe("Teacher discount");
  });

  it("only accepts a sensible percentage or amount", () => {
    expect(teacherDiscountSchema.safeParse({ type: "NONE" }).success).toBe(true);
    expect(teacherDiscountSchema.safeParse({ type: "PERCENT", value: 100 }).success).toBe(true);
    expect(teacherDiscountSchema.safeParse({ type: "PERCENT", value: 101 }).success).toBe(false);
    expect(teacherDiscountSchema.safeParse({ type: "PERCENT", value: 12.5 }).success).toBe(false);
    expect(teacherDiscountSchema.safeParse({ type: "FIXED", value: 2000 }).success).toBe(true);
    expect(teacherDiscountSchema.safeParse({ type: "FIXED", value: 0 }).success).toBe(false);
  });
});
