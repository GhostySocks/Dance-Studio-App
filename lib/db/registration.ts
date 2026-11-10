import { prisma } from "@/lib/prisma";

export async function isEmailRegistered(email: string) {
  const count = await prisma.user.count({ where: { email } });
  return count > 0;
}

function toDate(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** A parent account: User + Guardian + FamilyGroup, with their children as Students. */
export async function createFamilyAccount(data: {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone: string;
  dancers: { firstName: string; lastName: string; dateOfBirth: string }[];
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        passwordHash: data.passwordHash,
        role: "PARENT",
      },
      select: { id: true },
    });
    const guardian = await tx.guardian.create({
      data: { userId: user.id, phone: data.phone || null },
      select: { id: true },
    });
    const family = await tx.familyGroup.create({
      data: {
        name: `${data.lastName} Family`,
        guardians: { create: { guardianId: guardian.id } },
      },
      select: { id: true },
    });

    const students = [];
    for (const dancer of data.dancers) {
      students.push(
        await tx.student.create({
          data: {
            firstName: dancer.firstName,
            lastName: dancer.lastName,
            dateOfBirth: toDate(dancer.dateOfBirth),
            guardianId: guardian.id,
            familyGroupId: family.id,
          },
          select: { id: true },
        })
      );
    }

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "ACCOUNT_REGISTERED",
        entityType: "FamilyGroup",
        entityId: family.id,
        meta: { students: students.length },
      },
    });

    return { userId: user.id, studentIds: students.map((s) => s.id) };
  });
}

/** An adult student who registers and pays for themself. */
export async function createStudentAccount(data: {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  phone: string;
  dateOfBirth: string;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        passwordHash: data.passwordHash,
        role: "STUDENT",
      },
      select: { id: true },
    });
    const student = await tx.student.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        dateOfBirth: toDate(data.dateOfBirth),
        userId: user.id,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "ACCOUNT_REGISTERED",
        entityType: "Student",
        entityId: student.id,
      },
    });

    return { userId: user.id, studentIds: [student.id] };
  });
}

/** Students this user may enroll: a guardian's children, or the user themself. */
export async function getEnrollableStudents(userId: string) {
  return prisma.student.findMany({
    where: { OR: [{ guardian: { userId } }, { userId }] },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

/** Which of these students is already enrolled or waitlisted in the session. */
export async function getExistingEnrollments(studentIds: string[], sessionId: string) {
  return prisma.enrollment.findMany({
    where: { sessionId, studentId: { in: studentIds }, status: { in: ["ACTIVE", "WAITLIST"] } },
    select: { studentId: true, status: true },
  });
}
