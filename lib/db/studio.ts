import { prisma } from "@/lib/prisma";
import { clearStudioCache } from "@/lib/studio-cache";

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
