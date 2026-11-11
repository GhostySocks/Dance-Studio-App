import type { Prisma } from "@prisma/client";

import { clearAccountStatus } from "@/lib/account-status";
import { prisma } from "@/lib/prisma";

/**
 * Staff accounts (teachers and administrators) are created by an admin, never by
 * public sign-up. They are created without a password: the person sets one through
 * an emailed single-use link, so nobody else ever knows it.
 *
 * Removing a staff member disables the account (User.disabledAt) rather than
 * deleting it, so the classes they taught and the audit trail keep their name.
 * A disabled account cannot sign in and is signed out on its next request.
 */

interface TeacherProfile {
  phone: string;
  specialties: string[];
  bio: string;
}

/** An existing account with this email, whatever its state. */
export async function findAccountByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, disabledAt: true, teacher: { select: { id: true } } },
  });
}

export async function createTeacherAccount(
  data: { name: string; email: string } & TeacherProfile,
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

/** Brings back a teacher who was removed earlier, with their history intact. */
export async function reactivateTeacher(
  userId: string,
  data: { name: string } & TeacherProfile,
  actorId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { name: data.name, disabledAt: null },
      select: { id: true, email: true, name: true },
    });
    const teacher = await tx.teacher.update({
      where: { userId },
      data: { phone: data.phone || null, specialties: data.specialties, bio: data.bio || null },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: { actorId, action: "TEACHER_REACTIVATED", entityType: "Teacher", entityId: teacher.id },
    });
    return { teacherId: teacher.id, user };
  });
  clearAccountStatus(userId);
  return result;
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

/** Brings back an administrator who was removed earlier. */
export async function reactivateAdmin(userId: string, data: { name: string }, actorId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: data.name, disabledAt: null },
    select: { id: true, email: true, name: true },
  });
  await prisma.auditLog.create({
    data: { actorId, action: "ADMIN_REACTIVATED", entityType: "User", entityId: userId },
  });
  clearAccountStatus(userId);
  return { user };
}

/** Current administrators, with whether they have finished setting up their account. */
export async function getAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, disabledAt: null },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  // Never send the hash anywhere; only whether one exists
  return admins.map(({ passwordHash, ...admin }) => ({ ...admin, hasPassword: !!passwordHash }));
}

/** A current teacher or administrator by user id, for sending them a sign-in link. */
export async function getStaffUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: { in: ["TEACHER", "ADMIN", "SUPER_ADMIN"] }, disabledAt: null },
    select: { id: true, name: true, email: true, role: true },
  });
}

/** Disables the account and makes sure no old link or password can be used to get back in. */
async function disableUser(tx: Prisma.TransactionClient, user: { id: string; email: string }) {
  await tx.user.update({
    where: { id: user.id },
    data: { disabledAt: new Date(), passwordHash: null },
    select: { id: true },
  });
  await tx.verificationToken.deleteMany({
    where: { identifier: { in: [`reset:${user.email}`, `verify:${user.email}`] } },
  });
}

/** How many classes the teacher is still down to teach. */
export async function countUpcomingSessions(teacherId: string) {
  return prisma.classSession.count({ where: { teacherId, startTime: { gt: new Date() } } });
}

export type RemoveTeacherResult =
  | { status: "removed"; reassigned: number }
  | { status: "not-found" | "needs-reassign" | "bad-reassign" };

/**
 * Removes a teacher. Their past classes and attendance stay on record under their
 * name. Classes they were still due to teach must be handed to another teacher,
 * because a class cannot be left without one.
 */
export async function removeTeacher(
  teacherId: string,
  reassignToTeacherId: string | null,
  actorId: string
): Promise<RemoveTeacherResult> {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, user: { disabledAt: null } },
    select: { id: true, user: { select: { id: true, email: true } } },
  });
  if (!teacher) return { status: "not-found" };

  const now = new Date();
  const upcoming = await prisma.classSession.count({ where: { teacherId, startTime: { gt: now } } });
  if (upcoming > 0) {
    if (!reassignToTeacherId) return { status: "needs-reassign" };
    const target = await prisma.teacher.findFirst({
      where: { id: reassignToTeacherId, user: { disabledAt: null } },
      select: { id: true },
    });
    if (!target || target.id === teacherId) return { status: "bad-reassign" };
  }

  const reassigned = await prisma.$transaction(async (tx) => {
    const moved =
      upcoming > 0 && reassignToTeacherId
        ? (
            await tx.classSession.updateMany({
              where: { teacherId, startTime: { gt: now } },
              data: { teacherId: reassignToTeacherId },
            })
          ).count
        : 0;
    await disableUser(tx, teacher.user);
    await tx.auditLog.create({
      data: {
        actorId,
        action: "TEACHER_REMOVED",
        entityType: "Teacher",
        entityId: teacherId,
        meta: { reassigned: moved, reassignedTo: moved > 0 ? reassignToTeacherId : null },
      },
    });
    return moved;
  });

  clearAccountStatus(teacher.user.id);
  return { status: "removed", reassigned };
}

export type RemoveAdminResult = "removed" | "not-found" | "self" | "owner";

/**
 * Removes an administrator's access. You cannot remove yourself (so there is
 * always at least one administrator), and the studio owner cannot be removed here.
 */
export async function removeAdmin(userId: string, actorId: string): Promise<RemoveAdminResult> {
  if (userId === actorId) return "self";

  const user = await prisma.user.findFirst({
    where: { id: userId, role: { in: ["ADMIN", "SUPER_ADMIN"] }, disabledAt: null },
    select: { id: true, email: true, role: true },
  });
  if (!user) return "not-found";
  if (user.role === "SUPER_ADMIN") return "owner";

  await prisma.$transaction(async (tx) => {
    await disableUser(tx, user);
    await tx.auditLog.create({
      data: { actorId, action: "ADMIN_REMOVED", entityType: "User", entityId: userId },
    });
  });

  clearAccountStatus(userId);
  return "removed";
}
