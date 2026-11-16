import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakePayment {
  id: string;
  teacherId: string;
  startDay: string;
  endDay: string;
  classes: number;
  minutes: number;
  basis: string | null;
  rateCents: number | null;
  amountCents: number;
  paidOn: string;
  reference: string | null;
  note: string | null;
}

const state = vi.hoisted(() => ({
  payments: [] as FakePayment[],
  audit: [] as { action: string; meta: Record<string, unknown> }[],
  nextId: 1,
}));

const db = vi.hoisted(() => {
  const tx = {
    teacherPayment: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id?: string; teacherId: string; startDay?: { lte: string }; endDay?: { gte: string } };
        }) =>
          state.payments.find(
            (p) =>
              p.teacherId === where.teacherId &&
              (where.id === undefined || p.id === where.id) &&
              (where.startDay === undefined || p.startDay <= where.startDay.lte) &&
              (where.endDay === undefined || p.endDay >= where.endDay.gte)
          ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakePayment, "id"> }) => {
        const row = { ...data, id: `pay-${state.nextId++}` };
        state.payments.push(row);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        state.payments = state.payments.filter((p) => p.id !== where.id);
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
vi.mock("@/lib/db/teacher-report", () => ({
  getTeacherReport: vi.fn(async ({ teacherId }: { teacherId: string }) =>
    teacherId === "nobody"
      ? null
      : { teacher: { id: teacherId, name: "Maria Garcia" }, totals: { classes: 6, minutes: 360 } }
  ),
}));

import { deleteTeacherPayment, recordTeacherPayment } from "@/lib/db/teacher-payments";
import { nextDay, periodsOverlap } from "@/lib/teacher-report";

const pay = (startDay: string, endDay: string, extra: Partial<Parameters<typeof recordTeacherPayment>[0]> = {}) =>
  recordTeacherPayment({
    teacherId: "maria",
    startDay,
    endDay,
    amountCents: 24000,
    paidOn: "2026-11-16",
    timeZone: "America/New_York",
    actorId: "admin-1",
    ...extra,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-16T17:00:00Z"));
  state.payments = [];
  state.audit = [];
  state.nextId = 1;
});

describe("periodsOverlap", () => {
  const november = { startDay: "2026-11-01", endDay: "2026-11-15" };
  it("is true when the periods share a day, including just the first or last", () => {
    expect(periodsOverlap(november, { startDay: "2026-11-15", endDay: "2026-11-30" })).toBe(true);
    expect(periodsOverlap(november, { startDay: "2026-10-20", endDay: "2026-11-01" })).toBe(true);
    expect(periodsOverlap(november, { startDay: "2026-11-05", endDay: "2026-11-06" })).toBe(true);
    expect(periodsOverlap(november, { startDay: "2026-10-01", endDay: "2026-12-31" })).toBe(true);
  });
  it("is false for periods that sit side by side", () => {
    expect(periodsOverlap(november, { startDay: "2026-11-16", endDay: "2026-11-30" })).toBe(false);
    expect(periodsOverlap(november, { startDay: "2026-10-01", endDay: "2026-10-31" })).toBe(false);
  });
});

describe("nextDay", () => {
  it("steps over month and year ends", () => {
    expect(nextDay("2026-11-15")).toBe("2026-11-16");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("recordTeacherPayment", () => {
  it("stores the payment with the report's totals and writes an audit row", async () => {
    const payment = await pay("2026-11-01", "2026-11-15", {
      basis: "PER_CLASS",
      rateCents: 4000,
      reference: "Check 1042",
    });
    expect(payment).toMatchObject({
      startDay: "2026-11-01",
      endDay: "2026-11-15",
      classes: 6,
      minutes: 360,
      basis: "PER_CLASS",
      rateCents: 4000,
      amountCents: 24000,
      paidOn: "2026-11-16",
      reference: "Check 1042",
    });
    expect(state.audit[0]).toMatchObject({
      action: "TEACHER_PAYMENT_RECORDED",
      meta: { teacherId: "maria", startDay: "2026-11-01", endDay: "2026-11-15", amountCents: 24000 },
    });
  });

  it("keeps no rate unless both the basis and the rate are given", async () => {
    const payment = await pay("2026-11-01", "2026-11-15", { basis: "PER_HOUR" });
    expect(payment).toMatchObject({ basis: null, rateCents: null });
  });

  it("refuses a period that shares any day with one already paid", async () => {
    await pay("2026-11-01", "2026-11-10");
    await expect(pay("2026-11-10", "2026-11-15")).rejects.toThrow(/already paid for 2026-11-01 to 2026-11-10/);
    await expect(pay("2026-10-15", "2026-11-01")).rejects.toThrow(/already paid/);
    await expect(pay("2026-11-03", "2026-11-04")).rejects.toThrow(/already paid/);
    expect(state.payments).toHaveLength(1);
  });

  it("allows the period that starts the day after the last one", async () => {
    await pay("2026-11-01", "2026-11-10");
    await expect(pay("2026-11-11", "2026-11-16")).resolves.toMatchObject({ startDay: "2026-11-11" });
    expect(state.payments).toHaveLength(2);
  });

  it("does not mind another teacher being paid for the same days", async () => {
    await pay("2026-11-01", "2026-11-10");
    await expect(pay("2026-11-01", "2026-11-10", { teacherId: "james" })).resolves.toBeDefined();
  });

  it("refuses a period that has not finished in studio time", async () => {
    // 17:00 UTC on Nov 16 is still Nov 16 in New York
    await expect(pay("2026-11-01", "2026-11-17")).rejects.toThrow(/not finished/);
    await expect(pay("2026-11-01", "2026-11-16")).resolves.toBeDefined();
  });

  it("refuses an unknown teacher", async () => {
    await expect(pay("2026-11-01", "2026-11-10", { teacherId: "nobody" })).rejects.toThrow(/Teacher not found/);
  });
});

describe("deleteTeacherPayment", () => {
  it("removes the record so the period can be paid again", async () => {
    const payment = await pay("2026-11-01", "2026-11-10");
    await expect(
      deleteTeacherPayment({ teacherId: "maria", paymentId: payment.id, actorId: "admin-1" })
    ).resolves.toBe(true);
    expect(state.audit.at(-1)).toMatchObject({ action: "TEACHER_PAYMENT_REMOVED" });
    await expect(pay("2026-11-05", "2026-11-12")).resolves.toBeDefined();
  });

  it("reports a record that is not this teacher's as not found", async () => {
    const payment = await pay("2026-11-01", "2026-11-10");
    await expect(
      deleteTeacherPayment({ teacherId: "james", paymentId: payment.id, actorId: "admin-1" })
    ).resolves.toBe(false);
    expect(state.payments).toHaveLength(1);
  });
});
