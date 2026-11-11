import { NextResponse } from "next/server";
import type { z } from "zod";

import {
  createStudentWithHousehold,
  updateStudentWithHousehold,
  type HouseholdError,
  type StudentFields,
} from "@/lib/db/household";
import { inviteStaff } from "@/lib/staff-api";
import type { FamilyChoice, GuardianChoice } from "@/lib/validations/household";
import type { studentSchema } from "@/lib/validations/student";

const messages: Record<HouseholdError, { status: number; error: string }> = {
  "guardian-not-found": { status: 400, error: "That guardian no longer exists. Please choose again." },
  "family-not-found": { status: 400, error: "That family group no longer exists. Please choose again." },
  "email-in-use": {
    status: 409,
    error:
      "An account with the guardian's email already exists. If they are already a guardian, choose them from the existing guardians instead.",
  },
};

type StudentInput = z.output<typeof studentSchema>;

function fields(data: StudentInput): StudentFields {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth ?? null,
    email: data.email || null,
    phone: data.phone || null,
    medicalNotes: data.medicalNotes || null,
    notes: data.notes || null,
  };
}

/** Older callers send plain ids; treat them as "existing" or "none". */
function choices(data: StudentInput): { guardian: GuardianChoice; family: FamilyChoice } {
  return {
    guardian:
      data.guardian ??
      (data.guardianId ? { mode: "existing", guardianId: data.guardianId } : { mode: "none" }),
    family:
      data.family ??
      (data.familyGroupId ? { mode: "existing", familyGroupId: data.familyGroupId } : { mode: "none" }),
  };
}

/**
 * Creates (or, with `studentId`, updates) a student along with any new guardian
 * and family group, then invites a new guardian to the parent portal if asked.
 */
export async function saveStudent(data: StudentInput, actorId: string, studentId?: string) {
  const { guardian, family } = choices(data);

  const result = studentId
    ? await updateStudentWithHousehold(studentId, fields(data), guardian, family, actorId)
    : await createStudentWithHousehold(fields(data), guardian, family, actorId);

  if (!result.ok) {
    const { status, error } = messages[result.error];
    return NextResponse.json({ error }, { status });
  }

  let invite: { name: string; emailed: boolean; inviteUrl: string | null } | null = null;
  if (result.newGuardian && guardian.mode === "new" && guardian.invite) {
    const sent = await inviteStaff(result.newGuardian, `the parent or guardian of ${data.firstName}`);
    invite = { name: result.newGuardian.name, ...sent };
  }

  return NextResponse.json(
    { data: { id: result.studentId, invite } },
    { status: studentId ? 200 : 201 }
  );
}
