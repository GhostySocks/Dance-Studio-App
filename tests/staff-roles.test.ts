import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER";
  disabledAt: Date | null;
  passwordHash: string | null;
}
interface FakeTeacher {
  id: string;
  userId: string;
  removedAt: Date | null;
  bio: string | null;
  specialties: string[];
  phone: string | null;
}

const state = vi.hoisted(() => ({
  users: [] as FakeUser[],
  teachers: [] as FakeTeacher[],
  sessions: [] as { teacherId: string; startTime: Date }[],
  audit: [] as { action: string; meta?: Record<string, unknown> }[],
}));

const db = vi.hoisted(() => {
  const userOf = (teacher: FakeTeacher) => state.users.find((u) => u.id === teacher.userId)!;
  const tx = {
    user: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; role?: { in: string[] }; disabledAt?: null } }) => {
          const user = state.users.find(
            (u) =>
              u.id === where.id &&
              (!where.role || where.role.in.includes(u.role)) &&
              (where.disabledAt !== null || u.disabledAt === null)
          );
          if (!user) return null;
          const teacher = state.teachers.find((t) => t.userId === user.id);
          return { ...user, teacher: teacher ? { removedAt: teacher.removedAt } : null };
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
        const user = state.users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return { ...user };
      }),
    },
    teacher: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; removedAt?: null; user?: { disabledAt: null } } }) => {
          const teacher = state.teachers.find(
            (t) =>
              t.id === where.id &&
              (where.removedAt !== null || t.removedAt === null) &&
              (!where.user || userOf(t).disabledAt === null)
          );
          return teacher ? { id: teacher.id, user: { ...userOf(teacher) } } : null;
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeTeacher> }) => {
        const teacher = state.teachers.find((t) => t.id === where.id)!;
        Object.assign(teacher, data);
        return { id: teacher.id };
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId: string };
          create: Omit<FakeTeacher, "id" | "removedAt">;
          update: Partial<FakeTeacher>;
        }) => {
          let teacher = state.teachers.find((t) => t.userId === where.userId);
          if (teacher) Object.assign(teacher, update);
          else {
            teacher = { id: `teacher-${where.userId}`, removedAt: null, ...create };
            state.teachers.push(teacher);
          }
          return { id: teacher.id };
        }
      ),
    },
    classSession: {
      count: vi.fn(
        async ({ where }: { where: { teacherId: string } }) =>
          state.sessions.filter((s) => s.teacherId === where.teacherId && s.startTime > new Date()).length
      ),
      updateMany: vi.fn(
        async ({ where, data }: { where: { teacherId: string }; data: { teacherId: string } }) => {
          const rows = state.sessions.filter((s) => s.teacherId === where.teacherId && s.startTime > new Date());
          for (const row of rows) row.teacherId = data.teacherId;
          return { count: rows.length };
        }
      ),
    },
    verificationToken: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; meta?: Record<string, unknown> } }) => {
        state.audit.push(data);
      }),
    },
  };
  return { ...tx, $transaction: vi.fn(async (run: (t: typeof tx) => unknown) => run(tx)) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { addTeacherProfile, promoteTeacherToAdmin, removeAdmin, removeTeacher } from "@/lib/db/staff";

const user = (id: string) => state.users.find((u) => u.id === id)!;
const teacher = (id: string) => state.teachers.find((t) => t.id === id)!;
const profile = { phone: "", specialties: ["Ballet"], bio: "" };

beforeEach(() => {
  vi.clearAllMocks();
  state.audit = [];
  state.sessions = [];
  state.users = [
    { id: "owner", email: "owner@test.com", name: "Owner", role: "SUPER_ADMIN", disabledAt: null, passwordHash: "x" },
    { id: "sarah", email: "sarah@test.com", name: "Sarah", role: "ADMIN", disabledAt: null, passwordHash: "x" },
    { id: "maria", email: "maria@test.com", name: "Maria", role: "TEACHER", disabledAt: null, passwordHash: "x" },
  ];
  state.teachers = [
    { id: "t-maria", userId: "maria", removedAt: null, bio: null, specialties: [], phone: null },
  ];
});

describe("an administrator who also teaches", () => {
  it("gains a teacher profile without their account changing", async () => {
    const added = await addTeacherProfile("sarah", profile, "owner");
    expect(teacher(added.teacherId)).toMatchObject({ userId: "sarah", removedAt: null, specialties: ["Ballet"] });
    expect(user("sarah")).toMatchObject({ role: "ADMIN", disabledAt: null, passwordHash: "x" });
    expect(state.audit[0]).toMatchObject({ action: "TEACHER_PROFILE_ADDED" });
  });

  it("keeps their account and administrator access when removed as a teacher", async () => {
    const { teacherId } = await addTeacherProfile("sarah", profile, "owner");
    const result = await removeTeacher(teacherId, null, "owner");
    expect(result).toEqual({ status: "removed", reassigned: 0, keptAccount: true });
    expect(teacher(teacherId).removedAt).toBeInstanceOf(Date);
    expect(user("sarah")).toMatchObject({ role: "ADMIN", disabledAt: null, passwordHash: "x" });
  });

  it("gets the same teacher profile back when added as a teacher again", async () => {
    const { teacherId } = await addTeacherProfile("sarah", profile, "owner");
    await removeTeacher(teacherId, null, "owner");
    const again = await addTeacherProfile("sarah", profile, "owner");
    expect(again.teacherId).toBe(teacherId);
    expect(teacher(teacherId).removedAt).toBeNull();
    expect(state.teachers.filter((t) => t.userId === "sarah")).toHaveLength(1);
  });

  it("must still hand over upcoming classes before being removed as a teacher", async () => {
    const { teacherId } = await addTeacherProfile("sarah", profile, "owner");
    state.sessions.push({ teacherId, startTime: new Date(Date.now() + 86_400_000) });
    await expect(removeTeacher(teacherId, null, "owner")).resolves.toEqual({ status: "needs-reassign" });
    await expect(removeTeacher(teacherId, "t-maria", "owner")).resolves.toEqual({
      status: "removed",
      reassigned: 1,
      keptAccount: true,
    });
    expect(state.sessions[0].teacherId).toBe("t-maria");
  });

  it("stays on as a teacher when removed as an administrator", async () => {
    await addTeacherProfile("sarah", profile, "owner");
    await expect(removeAdmin("sarah", "owner")).resolves.toBe("now-teacher");
    expect(user("sarah")).toMatchObject({ role: "TEACHER", disabledAt: null, passwordHash: "x" });
    expect(state.audit.at(-1)).toMatchObject({ action: "ADMIN_REMOVED", meta: { keptAsTeacher: true } });
  });

  it("is disabled when removed as an administrator after they stopped teaching", async () => {
    const { teacherId } = await addTeacherProfile("sarah", profile, "owner");
    await removeTeacher(teacherId, null, "owner");
    await expect(removeAdmin("sarah", "owner")).resolves.toBe("removed");
    expect(user("sarah").disabledAt).toBeInstanceOf(Date);
  });
});

describe("the existing rules still hold", () => {
  it("disables a teacher-only account when the teacher is removed", async () => {
    await expect(removeTeacher("t-maria", null, "owner")).resolves.toEqual({
      status: "removed",
      reassigned: 0,
      keptAccount: false,
    });
    expect(user("maria")).toMatchObject({ passwordHash: null });
    expect(user("maria").disabledAt).toBeInstanceOf(Date);
    expect(teacher("t-maria").removedAt).toBeNull();
  });

  it("disables an administrator who does not teach, and protects the owner and yourself", async () => {
    await expect(removeAdmin("sarah", "owner")).resolves.toBe("removed");
    expect(user("sarah").disabledAt).toBeInstanceOf(Date);
    await expect(removeAdmin("owner", "sarah")).resolves.toBe("owner");
    await expect(removeAdmin("owner", "owner")).resolves.toBe("self");
  });

  it("makes a teacher an administrator as well, keeping their teacher profile", async () => {
    await promoteTeacherToAdmin("maria", "owner");
    expect(user("maria")).toMatchObject({ role: "ADMIN", disabledAt: null });
    expect(teacher("t-maria").removedAt).toBeNull();
  });
});
