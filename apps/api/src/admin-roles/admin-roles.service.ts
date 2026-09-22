import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type AdminsResponse = components['schemas']['AdminsResponse'];

/** Campos que descrevem uma pessoa administradora para quem chama a API. */
const adminFields = { id: true, name: true, email: true } as const;

/**
 * Ordenar no banco dependeria da collation do Postgres de cada instância
 * ("Álvaro" viria depois de "Zilda" sob `C`), então a ordem é montada em
 * memória com um colador pt-BR. Mesma decisão, e mesma razão, de
 * `unit-assignments.service.ts`.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

@Injectable()
export class AdminRolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<AdminsResponse> {
    const admins = await this.prisma.person.findMany({
      where: { organizationId, isAdmin: true },
      select: adminFields,
    });

    return {
      data: [...admins].sort(
        (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
      ),
    };
  }
}
