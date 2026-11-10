import { PrismaClient } from "@prisma/client";

import { ensureUpcomingSessions } from "./schedule";

/**
 * Adds upcoming sessions for every active class without touching existing data.
 * Usage: npm run db:schedule [-- <weeks>]
 */
const prisma = new PrismaClient();

async function main() {
  const weeks = Number(process.argv[2] ?? 8);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error("weeks must be a whole number from 1 to 52");
  }
  const created = await ensureUpcomingSessions(prisma, weeks);
  console.log(`Added ${created} upcoming session${created === 1 ? "" : "s"} (next ${weeks} weeks).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
