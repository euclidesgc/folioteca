import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type Space = components['schemas']['Space'];
type SpacesResponse = components['schemas']['SpacesResponse'];

/**
 * Ordenar no banco dependeria da collation do Postgres de cada instância
 * ("Álvaro" viria depois de "Zilda" sob `C`), então a ordem é montada em
 * memória com um colador pt-BR, como em `admin-roles.service.ts`.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Só os espaços das unidades em que a pessoa está lotada diretamente, na
   * organização dela. Ser administração não amplia a lista, e lotação numa
   * unidade não traz as unidades acima nem abaixo dela.
   */
  async list(organizationId: string, personId: string): Promise<SpacesResponse> {
    const rows = await this.prisma.space.findMany({
      where: {
        type: 'UNIT',
        orgUnit: {
          organizationId,
          assignments: { some: { personId } },
        },
      },
      select: { id: true, orgUnit: { select: { name: true } } },
    });

    const data = rows
      .flatMap((row): Space[] =>
        row.orgUnit
          ? [{ id: row.id, type: 'unit' as const, name: row.orgUnit.name }]
          : [],
      )
      .sort(
        (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
      );

    return { data };
  }
}
