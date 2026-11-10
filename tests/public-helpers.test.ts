import { describe, expect, it } from "vitest";

import { portalHome } from "@/lib/portal";
import { rateLimit } from "@/lib/rate-limit";
import { dayKey, formatTimeRange, groupByDay, spotsLabel } from "@/lib/schedule-format";
import { formatCurrency } from "@/lib/utils";
import { portalEnrollSchema, registrationSchema } from "@/lib/validations/registration";

const NY = "America/New_York";

describe("schedule formatting", () => {
  it("groups by the studio's calendar day, not UTC", () => {
    // 11pm and 1am New York on the same UTC date
    const sessions = [
      { startTime: "2026-11-13T04:00:00Z" }, // Thu 11pm ET
      { startTime: "2026-11-13T06:00:00Z" }, // Fri 1am ET
      { startTime: "2026-11-13T21:00:00Z" }, // Fri 4pm ET
    ];
    const days = groupByDay(sessions, NY);
    expect(days.map((d) => d.key)).toEqual(["2026-11-12", "2026-11-13"]);
    expect(days[0].heading).toBe("Thursday, November 12");
    expect(days[1].sessions).toHaveLength(2);
  });

  it("formats times in the studio timezone", () => {
    expect(formatTimeRange("2026-11-12T21:00:00Z", "2026-11-12T22:15:00Z", NY)).toBe(
      "4:00 PM – 5:15 PM"
    );
    expect(dayKey("2026-07-01T03:30:00Z", NY)).toBe("2026-06-30");
  });

  it("describes availability", () => {
    expect(spotsLabel(0)).toBe("Waitlist only");
    expect(spotsLabel(-2)).toBe("Waitlist only");
    expect(spotsLabel(1)).toBe("1 spot left");
    expect(spotsLabel(7)).toBe("7 spots left");
  });
});

describe("formatCurrency", () => {
  it("formats integer cents as dollars", () => {
    expect(formatCurrency(2500)).toBe("$25.00");
    expect(formatCurrency(5)).toBe("$0.05");
    expect(formatCurrency(-1250)).toBe("-$12.50");
    expect(formatCurrency(123456)).toBe("$1,234.56");
  });
});

describe("portalHome", () => {
  it("sends each role to its own portal", () => {
    expect(portalHome("SUPER_ADMIN")).toBe("/admin/dashboard");
    expect(portalHome("ADMIN")).toBe("/admin/dashboard");
    expect(portalHome("TEACHER")).toBe("/teacher/dashboard");
    expect(portalHome("PARENT")).toBe("/parent/dashboard");
    expect(portalHome("STUDENT")).toBe("/student/dashboard");
    expect(portalHome(undefined)).toBe("/");
  });
});

describe("rateLimit", () => {
  it("allows up to the limit, then blocks, per key", () => {
    const key = `test-${Math.random()}`;
    expect([1, 2, 3, 4].map(() => rateLimit(key, 3, 60_000))).toEqual([true, true, true, false]);
    expect(rateLimit(`${key}-other`, 3, 60_000)).toBe(true);
  });

  it("resets after the window", async () => {
    const key = `test-${Math.random()}`;
    expect(rateLimit(key, 1, 5)).toBe(true);
    expect(rateLimit(key, 1, 5)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(rateLimit(key, 1, 5)).toBe(true);
  });
});

describe("registrationSchema", () => {
  const base = {
    accountType: "PARENT",
    firstName: "Lisa",
    lastName: "Thompson",
    email: "  Lisa@Example.com ",
    password: "long-enough-password",
    phone: "",
    dateOfBirth: "",
    dancers: [{ firstName: "Emma", lastName: "Thompson", dateOfBirth: "2015-03-04", enroll: true }],
  };

  it("accepts a valid parent registration and normalizes the email", () => {
    const parsed = registrationSchema.parse(base);
    expect(parsed.email).toBe("lisa@example.com");
  });

  it("only allows PARENT and STUDENT accounts", () => {
    for (const accountType of ["ADMIN", "SUPER_ADMIN", "TEACHER", ""]) {
      expect(registrationSchema.safeParse({ ...base, accountType }).success).toBe(false);
    }
  });

  it("requires at least one dancer for a parent, none for an adult student", () => {
    expect(registrationSchema.safeParse({ ...base, dancers: [] }).success).toBe(false);
    expect(
      registrationSchema.safeParse({ ...base, accountType: "STUDENT", dancers: [] }).success
    ).toBe(true);
  });

  it("rejects weak passwords, bad emails and impossible dates", () => {
    expect(registrationSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, password: "x".repeat(73) }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, dateOfBirth: "2999-01-01" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, dateOfBirth: "yesterday" }).success).toBe(false);
  });

  it("caps the number of dancers", () => {
    const dancers = Array.from({ length: 9 }, () => base.dancers[0]);
    expect(registrationSchema.safeParse({ ...base, dancers }).success).toBe(false);
  });
});

describe("portalEnrollSchema", () => {
  it("needs a session and at least one student", () => {
    expect(portalEnrollSchema.safeParse({ sessionId: "s", studentIds: [] }).success).toBe(false);
    expect(portalEnrollSchema.safeParse({ sessionId: "", studentIds: ["a"] }).success).toBe(false);
    expect(portalEnrollSchema.safeParse({ sessionId: "s", studentIds: ["a"] }).success).toBe(true);
  });
});
