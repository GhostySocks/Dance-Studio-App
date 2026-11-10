import { beforeEach, describe, expect, it, vi } from "vitest";

/** A tiny in-memory stand-in for the enrollment and classSession tables. */
const store = vi.hoisted(() => {
  type Row = { id: string; studentId: string; sessionId: string; status: string; createdAt: Date };
  const state = { rows: [] as Row[], capacity: new Map<string, number>(), seq: 0 };

  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);

  const tables = {
    enrollment: {
      findUnique: async ({ where }: { where: { studentId_sessionId: { studentId: string; sessionId: string } } }) =>
        state.rows.find((r) => matches(r, where.studentId_sessionId)) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        state.rows
          .filter((r) => matches(r, where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null,
      count: async ({ where }: { where: Record<string, unknown> }) =>
        state.rows.filter((r) => matches(r, where)).length,
      create: async ({ data }: { data: { studentId: string; sessionId: string; status: string } }) => {
        const row = { id: `enr-${++state.seq}`, createdAt: new Date(2026, 0, 1, 0, state.seq), ...data };
        state.rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const row = state.rows.find((r) => r.id === where.id);
        if (!row) throw new Error("not found");
        Object.assign(row, data);
        return row;
      },
    },
    classSession: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.capacity.has(where.id) ? { maxCapacity: state.capacity.get(where.id) } : null,
    },
  };
  const tx = {
    ...tables,
    // SELECT ... FOR UPDATE on the session row
    $queryRaw: async (_sql: TemplateStringsArray, id: string) => (state.capacity.has(id) ? [{ id }] : []),
  };
  const prisma = { ...tables, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
  return { state, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: store.prisma }));

import { cancelEnrollment, enrollStudent } from "@/lib/db/enrollment";

const SESSION = "ses-1";
const statusOf = (studentId: string) =>
  store.state.rows.find((r) => r.studentId === studentId && r.sessionId === SESSION)?.status;

beforeEach(() => {
  store.state.rows = [];
  store.state.seq = 0;
  store.state.capacity = new Map([[SESSION, 2]]);
});

describe("enrollStudent", () => {
  it("enrolls while there is room", async () => {
    const result = await enrollStudent({ studentId: "a", sessionId: SESSION });
    expect(result).toMatchObject({ success: true, waitlist: false });
    expect(statusOf("a")).toBe("ACTIVE");
  });

  it("waitlists once the session is at capacity", async () => {
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    await enrollStudent({ studentId: "b", sessionId: SESSION });
    const result = await enrollStudent({ studentId: "c", sessionId: SESSION });
    expect(result).toMatchObject({ success: true, waitlist: true });
    expect(statusOf("c")).toBe("WAITLIST");
  });

  it("does not count waitlisted or cancelled students toward capacity", async () => {
    store.state.capacity.set(SESSION, 1);
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    await enrollStudent({ studentId: "b", sessionId: SESSION }); // waitlisted
    const a = store.state.rows.find((r) => r.studentId === "a")!;
    a.status = "CANCELLED";
    const result = await enrollStudent({ studentId: "c", sessionId: SESSION });
    expect(result.waitlist).toBe(false);
  });

  it("lets an admin force past capacity", async () => {
    store.state.capacity.set(SESSION, 1);
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    const result = await enrollStudent({ studentId: "b", sessionId: SESSION, force: true });
    expect(result).toMatchObject({ success: true, waitlist: false });
    expect(statusOf("b")).toBe("ACTIVE");
  });

  it("rejects a student who is already enrolled or waitlisted", async () => {
    store.state.capacity.set(SESSION, 1);
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    await enrollStudent({ studentId: "b", sessionId: SESSION });

    expect(await enrollStudent({ studentId: "a", sessionId: SESSION })).toMatchObject({
      success: false,
      error: "Student is already enrolled in this session",
    });
    expect(await enrollStudent({ studentId: "b", sessionId: SESSION })).toMatchObject({
      success: false,
      error: "Student is already on the waitlist for this session",
    });
    expect(store.state.rows).toHaveLength(2);
  });

  it("re-activates a cancelled enrollment instead of creating a duplicate", async () => {
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    store.state.rows[0].status = "CANCELLED";
    const result = await enrollStudent({ studentId: "a", sessionId: SESSION });
    expect(result).toMatchObject({ success: true, waitlist: false });
    expect(store.state.rows).toHaveLength(1);
    expect(statusOf("a")).toBe("ACTIVE");
  });

  it("re-enrolls a cancelled student onto the waitlist when the session has filled", async () => {
    store.state.capacity.set(SESSION, 1);
    await enrollStudent({ studentId: "a", sessionId: SESSION });
    store.state.rows[0].status = "CANCELLED";
    await enrollStudent({ studentId: "b", sessionId: SESSION });
    const result = await enrollStudent({ studentId: "a", sessionId: SESSION });
    expect(result.waitlist).toBe(true);
    expect(statusOf("a")).toBe("WAITLIST");
  });

  it("fails cleanly for a session that does not exist", async () => {
    const result = await enrollStudent({ studentId: "a", sessionId: "missing" });
    expect(result).toEqual({ success: false, error: "Session not found" });
    expect(store.state.rows).toHaveLength(0);
  });
});

describe("cancelEnrollment", () => {
  it("promotes the longest-waiting student when a spot opens", async () => {
    store.state.capacity.set(SESSION, 1);
    const first = await enrollStudent({ studentId: "a", sessionId: SESSION });
    await enrollStudent({ studentId: "b", sessionId: SESSION });
    await enrollStudent({ studentId: "c", sessionId: SESSION });

    const result = await cancelEnrollment(first.enrollment!.id);

    expect(statusOf("a")).toBe("CANCELLED");
    expect(statusOf("b")).toBe("ACTIVE");
    expect(statusOf("c")).toBe("WAITLIST");
    expect(result.promoted?.studentId).toBe("b");
  });

  it("promotes nobody when the waitlist is empty", async () => {
    const first = await enrollStudent({ studentId: "a", sessionId: SESSION });
    const result = await cancelEnrollment(first.enrollment!.id);
    expect(result.promoted).toBeNull();
  });

  it("does not promote when the session is still over capacity", async () => {
    store.state.capacity.set(SESSION, 1);
    const first = await enrollStudent({ studentId: "a", sessionId: SESSION });
    await enrollStudent({ studentId: "b", sessionId: SESSION, force: true });
    await enrollStudent({ studentId: "c", sessionId: SESSION });

    const result = await cancelEnrollment(first.enrollment!.id);

    expect(result.promoted).toBeNull();
    expect(statusOf("c")).toBe("WAITLIST");
  });
});
