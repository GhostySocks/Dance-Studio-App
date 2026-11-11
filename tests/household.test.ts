import { describe, expect, it } from "vitest";

import {
  emptyHousehold,
  householdFor,
  householdPayload,
  validateHousehold,
  type HouseholdDraft,
} from "@/components/forms/household-fields";
import { familyChoiceSchema, guardianChoiceSchema } from "@/lib/validations/household";

const draft = (patch: Partial<HouseholdDraft>): HouseholdDraft => ({ ...emptyHousehold(), ...patch });
const newGuardian = { name: "Gina Park", email: "gina@example.com", phone: "", address: "", invite: true };

describe("validateHousehold", () => {
  it("asks for a guardian choice before anything else", () => {
    expect(validateHousehold(emptyHousehold())).toHaveProperty("guardianMode");
  });

  it("accepts an adult student with no guardian and no family group", () => {
    expect(validateHousehold(draft({ guardianMode: "none" }))).toEqual({});
  });

  it("accepts a guardian without a family group", () => {
    expect(validateHousehold(draft({ guardianMode: "existing", guardianId: "g1", familyMode: "none" }))).toEqual({});
  });

  it("needs the guardian picked when 'existing' is chosen", () => {
    expect(validateHousehold(draft({ guardianMode: "existing" }))).toEqual({ guardianId: "Choose a guardian" });
  });

  it("needs a name and a valid email for a new guardian", () => {
    const blank = validateHousehold(draft({ guardianMode: "new" }));
    expect(blank).toHaveProperty("guardianName");
    expect(blank).toHaveProperty("guardianEmail");

    const badEmail = validateHousehold(draft({ guardianMode: "new", newGuardian: { ...newGuardian, email: "gina@" } }));
    expect(badEmail).toEqual({ guardianEmail: "Enter a valid email address" });

    expect(validateHousehold(draft({ guardianMode: "new", newGuardian }))).toEqual({});
  });

  it("needs the family group picked or named when one is wanted", () => {
    const base = { guardianMode: "none" as const };
    expect(validateHousehold(draft({ ...base, familyMode: "existing" }))).toHaveProperty("familyGroupId");
    expect(validateHousehold(draft({ ...base, familyMode: "new", newFamilyName: "  " }))).toHaveProperty("familyName");
    expect(validateHousehold(draft({ ...base, familyMode: "new", newFamilyName: "Park Family" }))).toEqual({});
  });
});

describe("householdPayload", () => {
  it("sends what the server expects for each combination", () => {
    const both = householdPayload(
      draft({ guardianMode: "new", newGuardian, familyMode: "new", newFamilyName: "Park Family" })
    );
    expect(guardianChoiceSchema.parse(both.guardian)).toMatchObject({ mode: "new", email: "gina@example.com" });
    expect(familyChoiceSchema.parse(both.family)).toEqual({ mode: "new", name: "Park Family" });

    const existing = householdPayload(
      draft({ guardianMode: "existing", guardianId: "g1", familyMode: "existing", familyGroupId: "f1" })
    );
    expect(existing).toEqual({
      guardian: { mode: "existing", guardianId: "g1" },
      family: { mode: "existing", familyGroupId: "f1" },
    });

    expect(householdPayload(draft({ guardianMode: "none" }))).toEqual({
      guardian: { mode: "none" },
      family: { mode: "none" },
    });
  });
});

describe("householdFor", () => {
  it("starts an edit from what the student already has", () => {
    expect(householdFor({ guardianId: "g1", familyGroupId: null })).toMatchObject({
      guardianMode: "existing",
      guardianId: "g1",
      familyMode: "none",
    });
    expect(householdFor({ guardianId: null, familyGroupId: "f1" })).toMatchObject({
      guardianMode: "none",
      familyMode: "existing",
      familyGroupId: "f1",
    });
  });
});

describe("server-side choices", () => {
  it("normalizes a new guardian's email and rejects bad input", () => {
    const parsed = guardianChoiceSchema.parse({ mode: "new", ...newGuardian, email: "  Gina@Example.COM " });
    expect(parsed).toMatchObject({ email: "gina@example.com" });
    expect(guardianChoiceSchema.safeParse({ mode: "new", ...newGuardian, name: "" }).success).toBe(false);
    expect(guardianChoiceSchema.safeParse({ mode: "existing", guardianId: "" }).success).toBe(false);
    expect(guardianChoiceSchema.safeParse({ mode: "admin" }).success).toBe(false);
  });

  it("cannot be used to set a role or password on the new account", () => {
    const parsed = guardianChoiceSchema.parse({ mode: "new", ...newGuardian, role: "ADMIN", passwordHash: "x" });
    expect(Object.keys(parsed).sort()).toEqual(["address", "email", "invite", "mode", "name", "phone"]);
  });
});
