import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type OrgUnit = components['schemas']['OrgUnit'];

/**
 * Sorting in the database would depend on the Postgres collation of each
 * instance ("Área" would come after "Zeladoria" under `C`), so the order is
 * built in memory with a pt-BR collator.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

@Injectable()
export class OrgUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<OrgUnit[]> {
    const units = await this.prisma.orgUnit.findMany({
      where: { organizationId },
      select: { id: true, parentId: true, name: true },
    });

    return [...units].sort(
      (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );
  }
}
