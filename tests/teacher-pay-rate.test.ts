import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeTeacher {
  id: string;
  payBasis: string | null;
  payRateCents: number | null;
}

const state = vi.hoisted(() => ({
  teachers: [] as FakeTeacher[],
  audit: [] as { action: string; entityId: string; meta: Record<string, unknown> }[],
}));

const db = vi.hoisted(() => {
  const tx = {
    teacher: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const teacher = state.teachers.find((t) => t.id === where.id);
        return teacher ? { ...teacher } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeTeacher> }) => {
        Object.assign(state.teachers.find((t) => t.id === where.id)!, data);
      }),
    },
    auditLog: {
      create: vi.fn(
        async ({ data }: { data: { action: string; entityId: string; meta: Record<string, unknown> } }) => {
          state.audit.push(data);
        }
      ),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { getTeacherPayRate, setTeacherPayRate } from "@/lib/db/teacher-pay-rate";
import { teacherPayRateSchema } from "@/lib/validations/teacher-payment";

beforeEach(() => {
  vi.clearAllMocks();
  state.audit = [];
  state.teachers = [
    { id: "maria", payBasis: null, payRateCents: null },
    { id: "james", payBasis: "PER_HOUR", payRateCents: 3500 },
  ];
});

describe("a teacher's pay rate", () => {
  it("is empty until one is set", async () => {
    await expect(getTeacherPayRate("maria")).resolves.toEqual({ rate: null });
  });

  it("stays as it was set, for that teacher only", async () => {
    await setTeacherPayRate({ teacherId: "maria", rate: { basis: "PER_CLASS", rateCents: 4000 }, actorId: "admin" });
    await expect(getTeacherPayRate("maria")).resolves.toEqual({ rate: { basis: "PER_CLASS", rateCents: 4000 } });
    await expect(getTeacherPayRate("james")).resolves.toEqual({ rate: { basis: "PER_HOUR", rateCents: 3500 } });
  });

  it("records who changed it, with the rate before and after", async () => {
    await setTeacherPayRate({ teacherId: "james", rate: { basis: "PER_CLASS", rateCents: 4500 }, actorId: "admin" });
    expect(state.audit).toEqual([
      expect.objectContaining({
        action: "TEACHER_PAY_RATE_SET",
        entityId: "james",
        meta: { basis: "PER_CLASS", rateCents: 4500, previousBasis: "PER_HOUR", previousRateCents: 3500 },
      }),
    ]);
  });

  it("writes nothing when the rate is saved unchanged", async () => {
    await setTeacherPayRate({ teacherId: "james", rate: { basis: "PER_HOUR", rateCents: 3500 }, actorId: "admin" });
    expect(db.teacher.update).not.toHaveBeenCalled();
    expect(state.audit).toHaveLength(0);
  });

  it("can be cleared", async () => {
    await setTeacherPayRate({ teacherId: "james", rate: null, actorId: "admin" });
    await expect(getTeacherPayRate("james")).resolves.toEqual({ rate: null });
  });

  it("reports a teacher that does not exist", async () => {
    await expect(getTeacherPayRate("nobody")).resolves.toBeNull();
    await expect(
      setTeacherPayRate({ teacherId: "nobody", rate: { basis: "PER_CLASS", rateCents: 100 }, actorId: "admin" })
    ).resolves.toBe(false);
  });

  it("must be a whole number of cents above zero", () => {
    expect(teacherPayRateSchema.safeParse({ basis: "PER_CLASS", rateCents: 4000 }).success).toBe(true);
    expect(teacherPayRateSchema.safeParse({ basis: "PER_CLASS", rateCents: null }).success).toBe(true);
    expect(teacherPayRateSchema.safeParse({ basis: "PER_CLASS", rateCents: 0 }).success).toBe(false);
    expect(teacherPayRateSchema.safeParse({ basis: "PER_CLASS", rateCents: -5 }).success).toBe(false);
    expect(teacherPayRateSchema.safeParse({ basis: "PER_CLASS", rateCents: 40.5 }).success).toBe(false);
    expect(teacherPayRateSchema.safeParse({ basis: "WEEKLY", rateCents: 4000 }).success).toBe(false);
  });
});
