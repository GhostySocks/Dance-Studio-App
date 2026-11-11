import { beforeEach, describe, expect, it, vi } from "vitest";

const system = vi.hoisted(() => ({ claimBillingRun: vi.fn(), recordBillingRun: vi.fn() }));
vi.mock("@/lib/db/system", () => system);
const service = vi.hoisted(() => ({ runBillingJobs: vi.fn() }));
vi.mock("@/lib/payment-service", () => service);

import { billingHourUtc, dueBillingDay, runBillingIfDue } from "@/lib/billing-scheduler";

const at = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  system.claimBillingRun.mockResolvedValue(true);
  system.recordBillingRun.mockResolvedValue(undefined);
  service.runBillingJobs.mockResolvedValue({ overdue: 2, charged: 1 });
});

describe("billingHourUtc", () => {
  it("defaults to 9 and ignores bad values", () => {
    expect(billingHourUtc(undefined)).toBe(9);
    expect(billingHourUtc("")).toBe(9);
    expect(billingHourUtc("soon")).toBe(9);
    expect(billingHourUtc("24")).toBe(9);
    expect(billingHourUtc("-1")).toBe(9);
    expect(billingHourUtc("0")).toBe(0);
    expect(billingHourUtc("14")).toBe(14);
  });
});

describe("dueBillingDay", () => {
  it("is not due before the hour, and due for the rest of the UTC day", () => {
    expect(dueBillingDay(at("2026-11-10T08:59:59Z"), 9)).toBeNull();
    expect(dueBillingDay(at("2026-11-10T09:00:00Z"), 9)).toBe("2026-11-10");
    expect(dueBillingDay(at("2026-11-10T23:59:00Z"), 9)).toBe("2026-11-10");
    expect(dueBillingDay(at("2026-11-11T00:10:00Z"), 9)).toBeNull();
  });
});

describe("runBillingIfDue", () => {
  it("does nothing before the scheduled hour", async () => {
    expect(await runBillingIfDue(at("2026-11-10T03:00:00Z"))).toBe("skipped");
    expect(system.claimBillingRun).not.toHaveBeenCalled();
  });

  it("runs once it is due and records the result", async () => {
    expect(await runBillingIfDue(at("2026-11-10T09:05:00Z"))).toBe("ran");
    expect(system.claimBillingRun).toHaveBeenCalledWith("2026-11-10");
    expect(system.recordBillingRun).toHaveBeenCalledWith("2026-11-10", {
      status: "completed",
      overdue: 2,
      charged: 1,
    });
  });

  it("does not run again when today's run is already claimed", async () => {
    system.claimBillingRun.mockResolvedValue(false);
    expect(await runBillingIfDue(at("2026-11-10T15:00:00Z"))).toBe("skipped");
    expect(service.runBillingJobs).not.toHaveBeenCalled();
  });

  it("records a failure without throwing", async () => {
    service.runBillingJobs.mockRejectedValue(new Error("boom"));
    expect(await runBillingIfDue(at("2026-11-10T09:05:00Z"))).toBe("failed");
    expect(system.recordBillingRun).toHaveBeenCalledWith("2026-11-10", { status: "failed" });
  });

  it("survives the database being unreachable", async () => {
    system.claimBillingRun.mockRejectedValue(new Error("no db"));
    expect(await runBillingIfDue(at("2026-11-10T09:05:00Z"))).toBe("failed");
    expect(service.runBillingJobs).not.toHaveBeenCalled();
  });
});
