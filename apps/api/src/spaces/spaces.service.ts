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

type ReachUnit = {
  id: string;
  parentId: string | null;
  space: { inheritsParent: boolean } | null;
  assignments: unknown[];
};

/**
 * Builds the memoized "does the person reach this unit's space" check. A unit
 * is reached when the person is assigned to it, or when its space inherits
 * and the parent is reached. Resolution is iterative: it climbs the parents
 * stacking the unresolved units and resolves them on the way back, so a deep
 * tree cannot overflow the call stack. A unit revisited within the same climb
 * (a parent cycle) counts as not reached.
 */
function resolveReach(units: ReachUnit[]): (unitId: string) => boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const memo = new Map<string, boolean>();

  return (unitId) => {
    const pending: ReachUnit[] = [];
    const visited = new Set<string>();
    let current = byId.get(unitId);
    let result = false;

    while (current) {
      const known = memo.get(current.id);
      if (known !== undefined) {
        result = known;
        break;
      }
      if (visited.has(current.id)) {
        result = false;
        break;
      }
      visited.add(current.id);

      if (current.assignments.length > 0) {
        memo.set(current.id, true);
        result = true;
        break;
      }
      if (current.space?.inheritsParent !== true || current.parentId === null) {
        memo.set(current.id, false);
        result = false;
        break;
      }

      pending.push(current);
      current = byId.get(current.parentId);
    }

    for (const unit of pending) {
      memo.set(unit.id, result);
    }

    return memo.get(unitId) ?? result;
  };
}

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * As unidades da organização com o espaço de cada uma e a lotação direta da
   * pessoa: a leitura de que `resolveReach` precisa.
   */
  private findReachUnits(organizationId: string, personId: string) {
    return this.prisma.orgUnit.findMany({
      where: { organizationId },
      select: {
        id: true,
        parentId: true,
        name: true,
        space: { select: { id: true, inheritsParent: true } },
        assignments: { where: { personId }, select: { personId: true } },
      },
    });
  }

  /**
   * Os espaços das unidades que a pessoa alcança e os espaços livres de que
   * ela é dona, sempre na organização dela. Alcança o espaço de uma unidade
   * quem está lotado nela ou, se o espaço herda da unidade-pai, quem alcança
   * o espaço da mãe (em cadeia, enquanto os espaços herdam). Ser
   * administração não amplia a lista.
   */
  async list(organizationId: string, personId: string): Promise<SpacesResponse> {
    const [freeRows, units] = await Promise.all([
      this.prisma.space.findMany({
        where: { type: 'FREE', organizationId, ownerId: personId },
        select: { id: true, name: true },
      }),
      this.findReachUnits(organizationId, personId),
    ]);

    const reaches = resolveReach(units);

    const unitSpaces = units.flatMap((unit): Space[] =>
      unit.space && reaches(unit.id)
        ? [{ id: unit.space.id, type: 'unit', name: unit.name }]
        : [],
    );

    const freeSpaces = freeRows.flatMap((row): Space[] =>
      row.name === null ? [] : [{ id: row.id, type: 'free', name: row.name }],
    );

    const data = [...unitSpaces, ...freeSpaces].sort(
      (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );

    return { data };
  }

  /**
   * Como a pessoa alcança o espaço de unidade informado, na organização dela:
   * `'direct'` se está lotada na unidade, `'inherited'` se o alcança só pela
   * herança entre unidades e `'none'` se não o alcança ou se o espaço não
   * existe ou não é de unidade.
   */
  async reachOf(
    organizationId: string,
    personId: string,
    spaceId: string,
  ): Promise<'direct' | 'inherited' | 'none'> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, type: 'UNIT', orgUnit: { organizationId } },
      select: {
        orgUnit: {
          select: {
            id: true,
            assignments: { where: { personId }, select: { personId: true } },
          },
        },
      },
    });

    if (space === null || space.orgUnit === null) {
      return 'none';
    }

    if (space.orgUnit.assignments.length > 0) {
      return 'direct';
    }

    const units = await this.findReachUnits(organizationId, personId);

    return resolveReach(units)(space.orgUnit.id) ? 'inherited' : 'none';
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
