import { prisma } from "@/lib/prisma";

const termSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  seasonId: true,
  season: { select: { id: true, name: true } },
  _count: { select: { registrations: true } },
} as const;

const seasonSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  _count: { select: { terms: true, registrations: true } },
} as const;

export async function getTermsAndSeasons() {
  const [terms, seasons] = await Promise.all([
    prisma.term.findMany({ select: termSelect, orderBy: { startDate: "asc" } }),
    prisma.season.findMany({ select: seasonSelect, orderBy: { startDate: "asc" } }),
  ]);
  return { terms, seasons };
}

interface DateRangeInput {
  name: string;
  startDate: Date;
  endDate: Date;
}

export async function createTerm(data: DateRangeInput & { seasonId: string | null }) {
  return prisma.term.create({ data, select: termSelect });
}

export async function updateTerm(id: string, data: DateRangeInput & { seasonId: string | null }) {
  return prisma.term.update({ where: { id }, data, select: termSelect });
}

export async function createSeason(data: DateRangeInput) {
  return prisma.season.create({ data, select: seasonSelect });
}

export async function updateSeason(id: string, data: DateRangeInput) {
  return prisma.season.update({ where: { id }, data, select: seasonSelect });
}

/** A term or season with registrations cannot be deleted: invoices refer to it. */
export async function deleteTerm(id: string): Promise<"deleted" | "in-use" | "not-found"> {
  const term = await prisma.term.findUnique({
    where: { id },
    select: { _count: { select: { registrations: true } } },
  });
  if (!term) return "not-found";
  if (term._count.registrations > 0) return "in-use";
  await prisma.term.delete({ where: { id } });
  return "deleted";
}

export async function deleteSeason(id: string): Promise<"deleted" | "in-use" | "not-found"> {
  const season = await prisma.season.findUnique({
    where: { id },
    select: { _count: { select: { registrations: true } } },
  });
  if (!season) return "not-found";
  if (season._count.registrations > 0) return "in-use";
  await prisma.season.delete({ where: { id } });
  return "deleted";
}

export async function termExists(id: string) {
  return (await prisma.term.count({ where: { id } })) > 0;
}

export async function seasonExists(id: string) {
  return (await prisma.season.count({ where: { id } })) > 0;
}
