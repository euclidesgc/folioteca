import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { createSpaceSchema } from './spaces.schema';

type Space = components['schemas']['Space'];
type SpaceResponse = components['schemas']['SpaceResponse'];
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
   * Os espaços das unidades em que a pessoa está lotada diretamente e os
   * espaços livres de que ela é dona, sempre na organização dela. Ser
   * administração não amplia a lista, e lotação numa unidade não traz as
   * unidades acima nem abaixo dela.
   */
  async list(organizationId: string, personId: string): Promise<SpacesResponse> {
    const rows = await this.prisma.space.findMany({
      where: {
        OR: [
          {
            type: 'UNIT',
            orgUnit: { organizationId, assignments: { some: { personId } } },
          },
          { type: 'FREE', organizationId, ownerId: personId },
        ],
      },
      select: {
        id: true,
        type: true,
        name: true,
        orgUnit: { select: { name: true } },
      },
    });

    const data = rows
      .flatMap((row): Space[] => {
        // Só o espaço de unidade tem `orgUnit` (a restrição da 0013 proíbe
        // unidade no espaço livre), então a presença dela já decide o tipo.
        if (row.orgUnit) {
          return [{ id: row.id, type: 'unit', name: row.orgUnit.name }];
        }
        if (row.type === 'FREE' && row.name !== null) {
          return [{ id: row.id, type: 'free', name: row.name }];
        }
        return [];
      })
      .sort(
        (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
      );

    return { data };
  }

  /**
   * Cria um espaço livre com a pessoa da sessão como dona. Organização e dona
   * chegam só por parâmetro (da sessão); o corpo aceita apenas o nome.
   */
  async create(
    organizationId: string,
    personId: string,
    body: unknown,
  ): Promise<SpaceResponse> {
    const { name } = parseBody(createSpaceSchema, body);

    const space = await this.prisma.space.create({
      data: { type: 'FREE', organizationId, ownerId: personId, name },
      select: { id: true, name: true },
    });

    return { data: { id: space.id, type: 'free', name: space.name ?? name } };
  }
}
