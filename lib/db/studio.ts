import { prisma } from "@/lib/prisma";
import { clearStudioCache } from "@/lib/studio-cache";
import { toTeacherDiscount, type TeacherDiscount } from "@/lib/teacher-discount";

const settingsSelect = {
  id: true,
  name: true,
  slug: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  timezone: true,
  billingCycleDay: true,
} as const;

/** The studio's discount for teachers on classes they take, or null when there is none. */
export async function getTeacherDiscount(): Promise<TeacherDiscount | null> {
  const studio = await prisma.studioProfile.findFirst({
    select: { teacherDiscountType: true, teacherDiscountValue: true },
  });
  return toTeacherDiscount(studio?.teacherDiscountType, studio?.teacherDiscountValue);
}

/**
 * Sets or clears (null) the teacher discount. It applies to invoices generated
 * from now on; invoices that already exist are not changed. Returns false if the
 * studio profile has not been created yet.
 */
export async function setTeacherDiscount(discount: TeacherDiscount | null, actorId: string): Promise<boolean> {
  const studio = await prisma.studioProfile.findFirst({ select: { id: true } });
  if (!studio) return false;
  await prisma.$transaction([
    prisma.studioProfile.update({
      where: { id: studio.id },
      data: { teacherDiscountType: discount?.type ?? null, teacherDiscountValue: discount?.value ?? null },
    }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "TEACHER_DISCOUNT_SET",
        entityType: "StudioProfile",
        entityId: studio.id,
        meta: { type: discount?.type ?? null, value: discount?.value ?? null },
      },
    }),
  ]);
  return true;
}

export async function getStudioSettings() {
  return prisma.studioProfile.findFirst({ select: settingsSelect });
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "studio"
  );
}

export async function updateStudioSettings(
  data: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
    billingCycleDay: number;
  },
  actorId: string
) {
  const values = {
    name: data.name,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    website: data.website || null,
    timezone: data.timezone,
    billingCycleDay: data.billingCycleDay,
  };

  const existing = await prisma.studioProfile.findFirst({ select: { id: true } });
  const studio = existing
    ? await prisma.studioProfile.update({
        where: { id: existing.id },
        data: values,
        select: settingsSelect,
      })
    : await prisma.studioProfile.create({
        data: { ...values, slug: slugify(data.name) },
        select: settingsSelect,
      });

  clearStudioCache();

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "STUDIO_SETTINGS_UPDATED",
      entityType: "StudioProfile",
      entityId: studio.id,
    },
  });
  return studio;
}
