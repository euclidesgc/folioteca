import type { PrismaClient } from '@prisma/client';

/** Esvazia as tabelas da instalação para cada teste começar do zero. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Session", "Space", "Person", "OrgUnit", "Organization" CASCADE',
  );
}
