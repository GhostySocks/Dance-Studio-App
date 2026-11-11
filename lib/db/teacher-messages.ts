import { prisma } from "@/lib/prisma";
import { TEACHER_CONTACT_DAYS } from "@/lib/teacher-contact";

/**
 * Whether this parent or adult student may message this teacher, and what the
 * teacher needs to know to answer: who is writing and which of their dancers are
 * in which of the teacher's classes.
 *
 * Returns null unless one of the user's own students (a guardian's children, or
 * the user themself) is enrolled or waitlisted in a current class of that teacher.
 */
export async function getTeacherMessageContext(userId: string, teacherId: string) {
  const since = new Date(Date.now() - TEACHER_CONTACT_DAYS * 24 * 60 * 60 * 1000);

  const [sender, teacher, enrollments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.teacher.findFirst({
      where: { id: teacherId, user: { disabledAt: null } },
      select: { user: { select: { name: true, email: true } } },
    }),
    prisma.enrollment.findMany({
      where: {
        status: { in: ["ACTIVE", "WAITLIST"] },
        student: { OR: [{ guardian: { userId } }, { userId }] },
        session: { teacherId, startTime: { gte: since } },
      },
      select: {
        student: { select: { firstName: true, lastName: true } },
        session: { select: { template: { select: { name: true } } } },
      },
    }),
  ]);
  if (!sender || !teacher || enrollments.length === 0) return null;

  // One line per dancer + class, however many dates they share
  const links = Array.from(
    new Set(
      enrollments.map(
        (e) => `${e.student.firstName} ${e.student.lastName} — ${e.session.template.name}`
      )
    )
  ).sort();

  return {
    sender,
    teacher: { name: teacher.user.name, email: teacher.user.email },
    links,
  };
}

export async function recordTeacherMessage(userId: string, teacherId: string) {
  // The message itself is not stored; this is only so misuse can be traced
  await prisma.auditLog.create({
    data: { actorId: userId, action: "TEACHER_MESSAGE_SENT", entityType: "Teacher", entityId: teacherId },
  });
}
