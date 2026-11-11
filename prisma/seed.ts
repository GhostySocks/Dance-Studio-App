import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { ensureUpcomingSessions, zonedTime } from "./schedule";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Clear all tables in reverse dependency order ───────────────────────────
  console.log("Clearing existing data...");
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.scholarship.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.classSession.deleteMany();
  await prisma.classTemplate.deleteMany();
  await prisma.term.deleteMany();
  await prisma.season.deleteMany();
  await prisma.room.deleteMany();
  await prisma.student.deleteMany();
  await prisma.familyGroupGuardian.deleteMany();
  await prisma.familyGroup.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.studioProfile.deleteMany();
  console.log("All tables cleared.\n");

  // ─── Studio Profile ─────────────────────────────────────────────────────────
  const studio = await prisma.studioProfile.create({
    data: {
      name: "Rhythm & Grace Dance Academy",
      slug: "rhythm-grace",
      timezone: "America/New_York",
      billingCycleDay: 1,
    },
  });
  console.log(`Created studio: ${studio.name}`);

  // ─── Users ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 10);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@dancestudio.com",
      name: "Sarah Johnson",
      role: "ADMIN",
      passwordHash,
    },
  });

  const teacherUser1 = await prisma.user.create({
    data: {
      email: "maria@dancestudio.com",
      name: "Maria Garcia",
      role: "TEACHER",
      passwordHash,
    },
  });

  const teacherUser2 = await prisma.user.create({
    data: {
      email: "james@dancestudio.com",
      name: "James Wilson",
      role: "TEACHER",
      passwordHash,
    },
  });

  const parentUser1 = await prisma.user.create({
    data: {
      email: "lisa@example.com",
      name: "Lisa Thompson",
      role: "PARENT",
      passwordHash,
    },
  });

  const parentUser2 = await prisma.user.create({
    data: {
      email: "michael@example.com",
      name: "Michael Chen",
      role: "PARENT",
      passwordHash,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: "alex@example.com",
      name: "Alex Rivera",
      role: "STUDENT",
      passwordHash,
    },
  });

  console.log(`Created ${6} users`);

  // ─── Teacher Profiles ───────────────────────────────────────────────────────
  const maria = await prisma.teacher.create({
    data: {
      userId: teacherUser1.id,
      bio: "Maria has over 15 years of experience in classical ballet and contemporary dance. She trained at the Royal Academy of Dance and has performed with several prestigious companies.",
      specialties: ["Ballet", "Contemporary", "Pointe"],
    },
  });

  const james = await prisma.teacher.create({
    data: {
      userId: teacherUser2.id,
      bio: "James is a dynamic hip-hop and jazz instructor who has been teaching for over a decade. His high-energy classes blend street dance culture with technical training.",
      specialties: ["Hip Hop", "Jazz", "Street Dance"],
    },
  });

  console.log("Created 2 teacher profiles");

  // ─── Guardian Profiles ──────────────────────────────────────────────────────
  const guardianLisa = await prisma.guardian.create({
    data: {
      userId: parentUser1.id,
      phone: "555-0101",
      address: "123 Oak Street, Anytown, NY 10001",
    },
  });

  const guardianMichael = await prisma.guardian.create({
    data: {
      userId: parentUser2.id,
      phone: "555-0102",
      address: "456 Maple Avenue, Anytown, NY 10002",
    },
  });

  console.log("Created 2 guardian profiles");

  // ─── Family Groups ──────────────────────────────────────────────────────────
  const thompsonFamily = await prisma.familyGroup.create({
    data: { name: "Thompson Family" },
  });

  const chenFamily = await prisma.familyGroup.create({
    data: { name: "Chen Family" },
  });

  console.log("Created 2 family groups");

  // ─── Connect guardians to family groups ─────────────────────────────────────
  await prisma.familyGroupGuardian.create({
    data: {
      familyGroupId: thompsonFamily.id,
      guardianId: guardianLisa.id,
    },
  });

  await prisma.familyGroupGuardian.create({
    data: {
      familyGroupId: chenFamily.id,
      guardianId: guardianMichael.id,
    },
  });

  console.log("Connected guardians to family groups");

  // ─── Students ───────────────────────────────────────────────────────────────
  const now = new Date();

  const emma = await prisma.student.create({
    data: {
      firstName: "Emma",
      lastName: "Thompson",
      dateOfBirth: new Date(now.getUTCFullYear() - 10, 3, 15),
      guardianId: guardianLisa.id,
      familyGroupId: thompsonFamily.id,
    },
  });

  const olivia = await prisma.student.create({
    data: {
      firstName: "Olivia",
      lastName: "Thompson",
      dateOfBirth: new Date(now.getUTCFullYear() - 8, 7, 22),
      guardianId: guardianLisa.id,
      familyGroupId: thompsonFamily.id,
    },
  });

  const ethan = await prisma.student.create({
    data: {
      firstName: "Ethan",
      lastName: "Chen",
      dateOfBirth: new Date(now.getUTCFullYear() - 12, 1, 10),
      guardianId: guardianMichael.id,
      familyGroupId: chenFamily.id,
    },
  });

  const sophia = await prisma.student.create({
    data: {
      firstName: "Sophia",
      lastName: "Chen",
      dateOfBirth: new Date(now.getUTCFullYear() - 9, 11, 5),
      guardianId: guardianMichael.id,
      familyGroupId: chenFamily.id,
    },
  });

  const alexStudent = await prisma.student.create({
    data: {
      firstName: "Alex",
      lastName: "Rivera",
      dateOfBirth: new Date(now.getUTCFullYear() - 22, 5, 30),
      userId: studentUser.id,
      email: "alex@example.com",
    },
  });

  console.log("Created 5 students");

  // ─── Rooms ──────────────────────────────────────────────────────────────────
  const [studioA, studioB, studioC] = await Promise.all([
    prisma.room.create({
      data: {
        name: "Studio A",
        capacity: 20,
        description: "Main studio with mirrors and barre",
      },
    }),
    prisma.room.create({
      data: {
        name: "Studio B",
        capacity: 15,
        description: "Smaller studio for intimate classes",
      },
    }),
    prisma.room.create({
      data: {
        name: "Studio C",
        capacity: 25,
        description: "Large performance studio",
      },
    }),
  ]);

  console.log("Created 3 rooms");

  // ─── Class Templates ────────────────────────────────────────────────────────
  const [
    beginnerBallet,
    intermediateBallet,
    hipHopFundamentals,
    jazzTechnique,
    contemporaryFlow,
    tinyDancers,
  ] = await Promise.all([
    prisma.classTemplate.create({
      data: {
        name: "Beginner Ballet",
        danceStyle: "Ballet",
        skillLevel: "Beginner",
        defaultDurationMins: 60,
        basePriceCents: 2500,
      },
    }),
    prisma.classTemplate.create({
      data: {
        name: "Intermediate Ballet",
        danceStyle: "Ballet",
        skillLevel: "Intermediate",
        defaultDurationMins: 75,
        basePriceCents: 3000,
      },
    }),
    prisma.classTemplate.create({
      data: {
        name: "Hip Hop Fundamentals",
        danceStyle: "Hip Hop",
        skillLevel: "Beginner",
        defaultDurationMins: 60,
        basePriceCents: 2500,
      },
    }),
    prisma.classTemplate.create({
      data: {
        name: "Jazz Technique",
        danceStyle: "Jazz",
        skillLevel: "Intermediate",
        defaultDurationMins: 60,
        basePriceCents: 2800,
      },
    }),
    prisma.classTemplate.create({
      data: {
        name: "Contemporary Flow",
        danceStyle: "Contemporary",
        skillLevel: "Advanced",
        defaultDurationMins: 90,
        basePriceCents: 3500,
      },
    }),
    prisma.classTemplate.create({
      data: {
        name: "Tiny Dancers",
        danceStyle: "Ballet",
        skillLevel: "Beginner",
        defaultDurationMins: 45,
        basePriceCents: 2000,
      },
    }),
  ]);

  console.log("Created 6 class templates");

  // ─── Compute next Monday (UTC) ─────────────────────────────────────────────
  const today = new Date();
  const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMonday = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + daysUntilMonday
    )
  );

  // Class times are wall-clock times in the studio timezone
  function sessionDate(dayOffset: number, hour: number, minute: number): Date {
    return zonedTime(
      "America/New_York",
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth(),
      nextMonday.getUTCDate() + dayOffset,
      hour,
      minute
    );
  }

  // ─── Class Sessions ─────────────────────────────────────────────────────────
  const beginnerBalletSession = await prisma.classSession.create({
    data: {
      templateId: beginnerBallet.id,
      teacherId: maria.id,
      roomId: studioA.id,
      startTime: sessionDate(0, 16, 0), // Mon 4:00pm
      endTime: sessionDate(0, 17, 0),   // Mon 5:00pm
      maxCapacity: 15,
    },
  });

  const intermediateBalletSession = await prisma.classSession.create({
    data: {
      templateId: intermediateBallet.id,
      teacherId: maria.id,
      roomId: studioA.id,
      startTime: sessionDate(1, 17, 0), // Tue 5:00pm
      endTime: sessionDate(1, 18, 15),  // Tue 6:15pm
      maxCapacity: 12,
    },
  });

  const hipHopSession = await prisma.classSession.create({
    data: {
      templateId: hipHopFundamentals.id,
      teacherId: james.id,
      roomId: studioB.id,
      startTime: sessionDate(2, 16, 0), // Wed 4:00pm
      endTime: sessionDate(2, 17, 0),   // Wed 5:00pm
      maxCapacity: 15,
    },
  });

  const jazzSession = await prisma.classSession.create({
    data: {
      templateId: jazzTechnique.id,
      teacherId: james.id,
      roomId: studioA.id,
      startTime: sessionDate(3, 17, 0), // Thu 5:00pm
      endTime: sessionDate(3, 18, 0),   // Thu 6:00pm
      maxCapacity: 12,
    },
  });

  const contemporarySession = await prisma.classSession.create({
    data: {
      templateId: contemporaryFlow.id,
      teacherId: maria.id,
      roomId: studioC.id,
      startTime: sessionDate(4, 16, 0),  // Fri 4:00pm
      endTime: sessionDate(4, 17, 30),   // Fri 5:30pm
      maxCapacity: 10,
    },
  });

  const tinyDancersSession = await prisma.classSession.create({
    data: {
      templateId: tinyDancers.id,
      teacherId: maria.id,
      roomId: studioB.id,
      startTime: sessionDate(5, 10, 0),  // Sat 10:00am
      endTime: sessionDate(5, 10, 45),   // Sat 10:45am
      maxCapacity: 12,
    },
  });

  console.log("Created 6 class sessions");

  // ─── Enrollments ────────────────────────────────────────────────────────────
  await prisma.enrollment.createMany({
    data: [
      { studentId: emma.id, sessionId: beginnerBalletSession.id, status: "ACTIVE" },
      { studentId: emma.id, sessionId: jazzSession.id, status: "ACTIVE" },
      { studentId: olivia.id, sessionId: tinyDancersSession.id, status: "ACTIVE" },
      { studentId: ethan.id, sessionId: hipHopSession.id, status: "ACTIVE" },
      { studentId: ethan.id, sessionId: intermediateBalletSession.id, status: "ACTIVE" },
      { studentId: sophia.id, sessionId: beginnerBalletSession.id, status: "ACTIVE" },
      { studentId: alexStudent.id, sessionId: contemporarySession.id, status: "ACTIVE" },
      { studentId: alexStudent.id, sessionId: hipHopSession.id, status: "ACTIVE" },
    ],
  });

  console.log("Created 8 enrollments");

  // A season and a term covering the next 8 weeks, with term prices on every class,
  // so whole-term registration can be tried straight away
  const termStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const termEnd = new Date(termStart.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
  const seasonEnd = new Date(Date.UTC(termStart.getUTCFullYear() + 1, termStart.getUTCMonth(), termStart.getUTCDate()));
  const season = await prisma.season.create({
    data: { name: "Current Season", startDate: termStart, endDate: seasonEnd },
  });
  await prisma.term.create({
    data: { name: "Current Term", startDate: termStart, endDate: termEnd, seasonId: season.id },
  });
  const templates = await prisma.classTemplate.findMany({ select: { id: true, basePriceCents: true } });
  await prisma.classPrice.createMany({
    data: templates.flatMap((t) => [
      { templateId: t.id, plan: "WEEKLY" as const, priceCents: Math.round(t.basePriceCents * 0.9) },
      { templateId: t.id, plan: "MONTHLY" as const, priceCents: Math.round(t.basePriceCents * 3.4) },
      { templateId: t.id, plan: "SEMESTER" as const, priceCents: Math.round(t.basePriceCents * 6.4) },
      { templateId: t.id, plan: "ANNUAL" as const, priceCents: Math.round(t.basePriceCents * 30) },
    ]),
  });
  console.log("Created 1 season, 1 term and term prices for every class");

  // Repeat each class weekly so the public schedule has something to show
  const extraSessions = await ensureUpcomingSessions(prisma, 8);
  console.log(`Created ${extraSessions} more weekly sessions`);

  // ─── Pricing Rule (Global) ─────────────────────────────────────────────────
  await prisma.pricingRule.create({
    data: {
      name: "Family Sibling Discount",
      triggerCount: 2,
      discountType: "PERCENT_OFF",
      discountValue: 50,
      isGlobal: true,
    },
  });

  console.log("Created 1 pricing rule");

  // ─── Scholarship ────────────────────────────────────────────────────────────
  const firstOfMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );

  await prisma.scholarship.create({
    data: {
      name: "Merit Scholarship",
      studentId: ethan.id,
      type: "FIXED",
      value: 5000,
      startDate: firstOfMonth,
    },
  });

  console.log("Created 1 scholarship");

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed completed successfully!");
  console.log("─────────────────────────────────");
  console.log("Studio Profile:  1");
  console.log("Users:           6");
  console.log("Teachers:        2");
  console.log("Guardians:       2");
  console.log("Family Groups:   2");
  console.log("Students:        5");
  console.log("Rooms:           3");
  console.log("Class Templates: 6");
  console.log(`Class Sessions:  ${6 + extraSessions}`);
  console.log("Enrollments:     8");
  console.log("Pricing Rules:   1");
  console.log("Scholarships:    1");
  console.log("─────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
