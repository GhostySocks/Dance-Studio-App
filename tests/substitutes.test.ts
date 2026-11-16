import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSession {
  id: string;
  teacherId: string;
  substituteForId: string | null;
  substituteReason: string | null;
  startTime: Date;
  endTime: Date;
  name: string;
}

const state = vi.hoisted(() => ({
  sessions: [] as FakeSession[],
  teachers: {} as Record<string, { name: string; disabled: boolean }>,
  audit: [] as { action: string; meta: Record<string, unknown> }[],
}));

const db = vi.hoisted(() => {
  const tx = {
    classSession: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = state.sessions.find((s) => s.id === where.id);
        return row ? { ...row } : null;
      }),
      // Is the substitute already teaching something that overlaps?
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: { not: string }; teacherId: string; startTime: { lt: Date }; endTime: { gt: Date } };
        }) => {
          const row = state.sessions.find(
            (s) =>
              s.id !== where.id.not &&
              s.teacherId === where.teacherId &&
              s.startTime < where.startTime.lt &&
              s.endTime > where.endTime.gt
          );
          return row ? { template: { name: row.name } } : null;
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeSession> }) => {
        const row = state.sessions.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return { id: row.id, teacherId: row.teacherId, substituteForId: row.substituteForId };
      }),
    },
    teacher: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = state.teachers[where.id];
        return row
          ? { id: where.id, user: { name: row.name, disabledAt: row.disabled ? new Date() : null } }
          : null;
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

import { assignSubstitute, removeSubstitute } from "@/lib/db/substitutes";

const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 20, hour, minute));
const assign = (substituteTeacherId: string, reason?: string) =>
  assignSubstitute({ sessionId: "ballet", substituteTeacherId, reason, actorId: "admin-1" });
const ballet = () => state.sessions.find((s) => s.id === "ballet")!;

beforeEach(() => {
  vi.clearAllMocks();
  state.audit = [];
  state.teachers = {
    maria: { name: "Maria Garcia", disabled: false },
    james: { name: "James Wilson", disabled: false },
    dana: { name: "Dana Lee", disabled: false },
    gone: { name: "Former Teacher", disabled: true },
  };
  // Maria's ballet class, 5 to 6pm; James teaches jazz 7 to 8pm the same day
  state.sessions = [
    { id: "ballet", teacherId: "maria", substituteForId: null, substituteReason: null, startTime: at(17), endTime: at(18), name: "Ballet" },
    { id: "jazz", teacherId: "james", substituteForId: null, substituteReason: null, startTime: at(19), endTime: at(20), name: "Jazz" },
  ];
});

describe("assignSubstitute", () => {
  it("makes the substitute the class's teacher and remembers the regular one", async () => {
    await assign("james", "  Out sick ");
    expect(ballet()).toMatchObject({
      teacherId: "james",
      substituteForId: "maria",
      substituteReason: "Out sick",
    });
    expect(state.audit[0]).toMatchObject({
      action: "SUBSTITUTE_ASSIGNED",
      meta: { regularTeacherId: "maria", substituteTeacherId: "james", reason: "Out sick" },
    });
  });

  it("keeps the original regular teacher when the substitute is changed", async () => {
    await assign("james");
    await assign("dana");
    expect(ballet()).toMatchObject({ teacherId: "dana", substituteForId: "maria" });
  });

  it("refuses the regular teacher as their own substitute", async () => {
    await expect(assign("maria")).rejects.toThrow(/regular teacher/);
    await assign("james");
    await expect(assign("maria")).rejects.toThrow(/regular teacher/);
    expect(ballet().teacherId).toBe("james");
  });

  it("refuses a substitute who is teaching another class at that time", async () => {
    state.sessions[1].startTime = at(17, 30);
    state.sessions[1].endTime = at(18, 30);
    await expect(assign("james")).rejects.toThrow(/James Wilson is already teaching Jazz/);
    expect(ballet()).toMatchObject({ teacherId: "maria", substituteForId: null });
  });

  it("allows a substitute whose own class ends exactly when this one starts", async () => {
    state.sessions[1].startTime = at(16);
    state.sessions[1].endTime = at(17);
    await expect(assign("james")).resolves.toMatchObject({ teacherId: "james" });
  });

  it("refuses a removed or unknown teacher, and an unknown class", async () => {
    await expect(assign("gone")).rejects.toThrow(/no longer available/);
    await expect(assign("nobody")).rejects.toThrow(/no longer available/);
    await expect(
      assignSubstitute({ sessionId: "nope", substituteTeacherId: "james", actorId: "admin-1" })
    ).rejects.toThrow(/Class not found/);
  });

  it("stores no reason when none is given", async () => {
    await assign("james", "   ");
    expect(ballet().substituteReason).toBeNull();
  });
});

describe("removeSubstitute", () => {
  it("hands the class back to its regular teacher", async () => {
    await assign("james", "Out sick");
    await removeSubstitute({ sessionId: "ballet", actorId: "admin-1" });
    expect(ballet()).toMatchObject({ teacherId: "maria", substituteForId: null, substituteReason: null });
    expect(state.audit.at(-1)).toMatchObject({
      action: "SUBSTITUTE_REMOVED",
      meta: { regularTeacherId: "maria", substituteTeacherId: "james" },
    });
  });

  it("refuses a class that has no substitute", async () => {
    await expect(removeSubstitute({ sessionId: "ballet", actorId: "admin-1" })).rejects.toThrow(/no substitute/);
    expect(ballet().teacherId).toBe("maria");
  });
});
