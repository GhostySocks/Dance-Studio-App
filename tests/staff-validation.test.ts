import { describe, expect, it } from "vitest";

import {
  newAdminSchema,
  newTeacherSchema,
  parseSpecialties,
  teacherProfileFormSchema,
} from "@/lib/validations/staff";

describe("parseSpecialties", () => {
  it("splits a comma-separated list and trims it", () => {
    expect(parseSpecialties("Ballet,  Contemporary ,Jazz")).toEqual(["Ballet", "Contemporary", "Jazz"]);
  });

  it("drops blanks and duplicates, ignoring case, keeping the first spelling", () => {
    expect(parseSpecialties("Tap, , tap, Jazz,TAP,jazz,")).toEqual(["Tap", "Jazz"]);
  });

  it("returns an empty list for empty text", () => {
    expect(parseSpecialties("")).toEqual([]);
    expect(parseSpecialties(" , ,")).toEqual([]);
  });
});

describe("teacherProfileFormSchema", () => {
  it("accepts specialties as the text the form field holds", () => {
    // This used to be validated as a list, so editing the field always failed
    const parsed = teacherProfileFormSchema.safeParse({
      phone: "",
      specialties: "Hip Hop, Jazz, Tap",
      bio: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects over-long values", () => {
    expect(
      teacherProfileFormSchema.safeParse({ phone: "1".repeat(21), specialties: "", bio: "" }).success
    ).toBe(false);
    expect(
      teacherProfileFormSchema.safeParse({ phone: "", specialties: "", bio: "x".repeat(2001) }).success
    ).toBe(false);
  });
});

describe("new staff schemas", () => {
  it("normalizes the email and requires a name", () => {
    const admin = newAdminSchema.parse({ name: " Sam Lee ", email: " Sam@Example.com " });
    expect(admin).toEqual({ name: "Sam Lee", email: "sam@example.com" });
    expect(newAdminSchema.safeParse({ name: "", email: "sam@example.com" }).success).toBe(false);
    expect(newAdminSchema.safeParse({ name: "Sam", email: "not-an-email" }).success).toBe(false);
  });

  it("ignores any role or password a caller tries to send", () => {
    const admin = newAdminSchema.parse({
      name: "Sam",
      email: "sam@example.com",
      role: "SUPER_ADMIN",
      passwordHash: "x",
    });
    expect(Object.keys(admin).sort()).toEqual(["email", "name"]);

    const teacher = newTeacherSchema.parse({
      name: "Sam",
      email: "sam@example.com",
      phone: "",
      specialties: "",
      bio: "",
      role: "ADMIN",
    });
    expect("role" in teacher).toBe(false);
  });
});
