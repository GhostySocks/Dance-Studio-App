import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

import type { FamilyChoice, GuardianChoice } from "@/lib/validations/household";

/** Guardians an admin can pick for a student, with the family groups they belong to. */
export async function getGuardianOptions() {
  const guardians = await prisma.guardian.findMany({
    where: { user: { disabledAt: null } },
    select: {
      id: true,
      phone: true,
      user: { select: { name: true, email: true } },
      familyGroups: { select: { familyGroup: { select: { id: true, name: true } } } },
    },
    orderBy: { user: { name: "asc" } },
  });
  return guardians.map((g) => ({
    id: g.id,
    name: g.user.name,
    email: g.user.email,
    phone: g.phone,
    families: g.familyGroups.map((f) => f.familyGroup),
  }));
}

export type HouseholdError = "guardian-not-found" | "family-not-found" | "email-in-use";

export interface StudentFields {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  email: string | null;
  phone: string | null;
  medicalNotes: string | null;
  notes: string | null;
}

/**
 * Turns the guardian and family choices into ids, creating what is new:
 * - a new guardian gets a parent account (no password yet) and a Guardian profile
 * - a new family group is created with the guardian in it
 * - a guardian placed with an existing family group is added to that group, so
 *   they can see and pay the family's invoices
 *
 * A student may have a guardian without any family group: they are then billed
 * on their own and the guardian pays for them.
 */
async function resolveHousehold(
  tx: Prisma.TransactionClient,
  guardian: GuardianChoice,
  family: FamilyChoice,
  actorId: string
) {
  let guardianId: string | null = null;
  let newGuardian: { id: string; name: string; email: string } | null = null;

  if (guardian.mode === "existing") {
    const found = await tx.guardian.findUnique({ where: { id: guardian.guardianId }, select: { id: true } });
    if (!found) throw new HouseholdProblem("guardian-not-found");
    guardianId = found.id;
  } else if (guardian.mode === "new") {
    const taken = await tx.user.count({ where: { email: guardian.email } });
    if (taken > 0) throw new HouseholdProblem("email-in-use");
    const user = await tx.user.create({
      data: { name: guardian.name, email: guardian.email, role: "PARENT" },
      select: { id: true, name: true, email: true },
    });
    const created = await tx.guardian.create({
      data: { userId: user.id, phone: guardian.phone || null, address: guardian.address || null },
      select: { id: true },
    });
    guardianId = created.id;
    newGuardian = user;
    await tx.auditLog.create({
      data: { actorId, action: "GUARDIAN_CREATED", entityType: "Guardian", entityId: created.id },
    });
  }

  let familyGroupId: string | null = null;
  if (family.mode === "existing") {
    const found = await tx.familyGroup.findUnique({
      where: { id: family.familyGroupId },
      select: { id: true },
    });
    if (!found) throw new HouseholdProblem("family-not-found");
    familyGroupId = found.id;
  } else if (family.mode === "new") {
    const created = await tx.familyGroup.create({ data: { name: family.name }, select: { id: true } });
    familyGroupId = created.id;
    await tx.auditLog.create({
      data: { actorId, action: "FAMILY_GROUP_CREATED", entityType: "FamilyGroup", entityId: created.id },
    });
  }

  if (guardianId && familyGroupId) {
    await tx.familyGroupGuardian.upsert({
      where: { familyGroupId_guardianId: { familyGroupId, guardianId } },
      create: { familyGroupId, guardianId },
      update: {},
    });
  }

  return { guardianId, familyGroupId, newGuardian };
}

class HouseholdProblem extends Error {
  constructor(public readonly code: HouseholdError) {
    super(code);
  }
}

type SaveResult =
  | { ok: true; studentId: string; newGuardian: { id: string; name: string; email: string } | null }
  | { ok: false; error: HouseholdError };

async function run(work: (tx: Prisma.TransactionClient) => Promise<SaveResult>): Promise<SaveResult> {
  try {
    return await prisma.$transaction(work);
  } catch (error) {
    // Nothing is kept: no orphaned guardian or family if a later step fails
    if (error instanceof HouseholdProblem) return { ok: false, error: error.code };
    throw error;
  }
}

/** Creates a student together with any new guardian and family group, all or nothing. */
export async function createStudentWithHousehold(
  student: StudentFields,
  guardian: GuardianChoice,
  family: FamilyChoice,
  actorId: string
) {
  return run(async (tx) => {
    const household = await resolveHousehold(tx, guardian, family, actorId);
    const created = await tx.student.create({
      data: { ...student, guardianId: household.guardianId, familyGroupId: household.familyGroupId },
      select: { id: true },
    });
    return { ok: true, studentId: created.id, newGuardian: household.newGuardian };
  });
}

export async function updateStudentWithHousehold(
  studentId: string,
  student: StudentFields,
  guardian: GuardianChoice,
  family: FamilyChoice,
  actorId: string
) {
  return run(async (tx) => {
    const household = await resolveHousehold(tx, guardian, family, actorId);
    await tx.student.update({
      where: { id: studentId },
      data: { ...student, guardianId: household.guardianId, familyGroupId: household.familyGroupId },
      select: { id: true },
    });
    return { ok: true, studentId, newGuardian: household.newGuardian };
  });
}
