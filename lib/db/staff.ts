import { prisma } from "@/lib/prisma";

/**
 * Staff accounts (teachers and administrators) are created by an admin, never by
 * public sign-up. They are created without a password: the person sets one through
 * an emailed single-use link, so nobody else ever knows it.
 */

export async function createTeacherAccount(
  data: { name: string; email: string; phone: string; specialties: string[]; bio: string },
  actorId: string
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: data.name, email: data.email, role: "TEACHER" },
      select: { id: true, email: true, name: true },
    });
    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        phone: data.phone || null,
        specialties: data.specialties,
        bio: data.bio || null,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: { actorId, action: "TEACHER_CREATED", entityType: "Teacher", entityId: teacher.id },
    });
    return { teacherId: teacher.id, user };
  });
}

export async function createAdminAccount(data: { name: string; email: string }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: data.name, email: data.email, role: "ADMIN" },
      select: { id: true, email: true, name: true },
    });
    await tx.auditLog.create({
      data: { actorId, action: "ADMIN_CREATED", entityType: "User", entityId: user.id },
    });
    return { user };
  });
}

/** Administrators, with whether they have finished setting up their account. */
export async function getAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // Never send the hash anywhere; only whether one exists
  return admins.map(({ passwordHash, ...admin }) => ({ ...admin, hasPassword: !!passwordHash }));
}

/** A teacher or administrator by user id, for sending them a sign-in link. */
export async function getStaffUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: { in: ["TEACHER", "ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
  });
}
