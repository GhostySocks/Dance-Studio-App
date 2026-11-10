import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma's default pool is (CPU cores × 2 + 1) connections, which is more than a
 * Supabase session pooler allows (15) on most machines. Cap it unless the URL
 * already sets its own limit.
 */
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("connection_limit=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=5`;
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
