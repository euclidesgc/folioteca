import { ConflictException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { isUniqueViolation } from '../common/is-unique-violation';
import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { orgUnitNotFound } from './org-unit-not-found';
import {
  createOrgUnitSchema,
  updateOrgUnitSchema,
  updateOrgUnitSpaceSchema,
} from './org-units.schema';

type OrgUnit = components['schemas']['OrgUnit'];
type OrgUnitResponse = components['schemas']['OrgUnitResponse'];

const FOREIGN_KEY_VIOLATION = 'P2003';

const NAME_TAKEN_MESSAGE = 'Já existe uma unidade com esse nome neste nível.';

export const ROOT_MESSAGE = 'A unidade raiz não pode ser apagada.';

export const HAS_CHILDREN_MESSAGE =
  'Apague ou mova as unidades filhas antes de apagar esta unidade.';

export const HAS_DOCUMENTS_MESSAGE =
  'O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade.';

export const HAS_PEOPLE_MESSAGE =
  'Ainda há pessoas lotadas nesta unidade. Tire a lotação delas antes de apagar a unidade.';

export const CHANGED_MESSAGE =
  'A unidade mudou enquanto era apagada. Recarregue a estrutura e tente de novo.';

/** Campos que descrevem uma unidade para quem chama a API. */
const orgUnitFields = {
  id: true,
  parentId: true,
  name: true,
  space: { select: { inheritsParent: true } },
} as const;

type OrgUnitRow = {
  id: string;
  parentId: string | null;
  name: string;
  space: { inheritsParent: boolean } | null;
};

/**
 * Maps a unit row to the contract shape. A unit without a space (which should
 * not exist) is reported as `own`.
 */
function toOrgUnit({ id, parentId, name, space }: OrgUnitRow): OrgUnit {
  return {
    id,
    parentId,
    name,
    spaceAccess: space?.inheritsParent === true ? 'inherit' : 'own',
  };
}

/**
 * Reconhece a recusa de uma chave estrangeira em `RESTRICT`. É a rede da
 * corrida: alguém criou uma filha ou um documento entre a contagem e o
 * `delete`, e o banco barra o que o serviço já tinha conferido.
 */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_VIOLATION
  );
}

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
      select: orgUnitFields,
    });

    return units.map(toOrgUnit).sort(
      (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );
  }

  /**
   * Cria a unidade filha e o espaço `UNIT` dela na mesma transação: ou a
   * unidade nasce com o próprio espaço, ou não nasce.
   */
  async create(organizationId: string, body: unknown): Promise<OrgUnit> {
    const { parentId, name } = parseBody(createOrgUnitSchema, body);

    if (!isUuid(parentId)) {
      throw orgUnitNotFound();
    }

    const parent = await this.prisma.orgUnit.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true },
    });

    if (!parent) {
      throw orgUnitNotFound();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const unit = await tx.orgUnit.create({
          data: { organizationId, parentId, name },
          select: orgUnitFields,
        });

        const space = await tx.space.create({
          data: { type: 'UNIT', orgUnitId: unit.id },
          select: { inheritsParent: true },
        });

        return toOrgUnit({ ...unit, space });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }

      throw error;
    }
  }

  /**
   * Renomeia a unidade. Na raiz (`parentId` nulo) o nome novo passa a ser
   * também o nome da organização, na mesma transação. O id é resolvido antes
   * de olhar o corpo: quem não enxerga a unidade recebe 404, nunca 400.
   */
  async rename(
    organizationId: string,
    orgUnitId: string,
    body: unknown,
  ): Promise<OrgUnit> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const unit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true, parentId: true },
    });

    if (!unit) {
      throw orgUnitNotFound();
    }

    const { name } = parseBody(updateOrgUnitSchema, body);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const renamed = await tx.orgUnit.update({
          where: { id: unit.id },
          data: { name },
          select: orgUnitFields,
        });

        if (unit.parentId === null) {
          await tx.organization.update({
            where: { id: organizationId },
            data: { name },
          });
        }

        return toOrgUnit(renamed);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }

      throw error;
    }
  }

  /**
   * Muda quem vê o espaço da unidade: `own` (só os lotados nela) ou `inherit`
   * (também quem vê o espaço da unidade-pai). O id é resolvido antes de olhar
   * o corpo, como no renomear; a raiz recusa `inherit` com 409. Marcar o modo
   * atual é aceito e devolve a unidade como está.
   */
  async setSpaceAccess(
    organizationId: string,
    orgUnitId: string,
    body: unknown,
  ): Promise<OrgUnitResponse> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const unit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true, parentId: true, name: true },
    });

    if (!unit) {
      throw orgUnitNotFound();
    }

    const { access } = parseBody(updateOrgUnitSpaceSchema, body);

    if (access === 'inherit' && unit.parentId === null) {
      throw new ConflictException('A unidade raiz não tem unidade-pai.');
    }

    const space = await this.prisma.space.update({
      where: { orgUnitId },
      data: { inheritsParent: access === 'inherit' },
      select: { inheritsParent: true },
    });

    return { data: toOrgUnit({ ...unit, space }) };
  }

  /**
   * Apaga a unidade e o espaço `UNIT` dela na mesma transação. Uma consulta só
   * traz tudo o que a regra precisa; a recusa segue a ordem raiz → filhas →
   * documentos → pessoas. A contagem de documentos vai pela relação do espaço
   * (a tabela `Document` é de outro módulo) e **não** filtra `trashedAt`:
   * documento na lixeira também segura a unidade.
   *
   * A contagem de lotações existe porque a chave estrangeira da lotação é
   * `RESTRICT`: sem ela, a recusa do banco chegaria como `P2003` e viraria o
   * 409 de corrida, que manda recarregar e não resolve nada.
   */
  async remove(organizationId: string, orgUnitId: string): Promise<void> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const unit = await tx.orgUnit.findFirst({
          where: { id: orgUnitId, organizationId },
          select: {
            id: true,
            parentId: true,
            _count: { select: { children: true, assignments: true } },
            space: { select: { id: true, _count: { select: { documents: true } } } },
          },
        });

        if (!unit) {
          throw orgUnitNotFound();
        }

        if (unit.parentId === null) {
          throw new ConflictException(ROOT_MESSAGE);
        }

        if (unit._count.children > 0) {
          throw new ConflictException(HAS_CHILDREN_MESSAGE);
        }

        if (unit.space && unit.space._count.documents > 0) {
          throw new ConflictException(HAS_DOCUMENTS_MESSAGE);
        }

        if (unit._count.assignments > 0) {
          throw new ConflictException(HAS_PEOPLE_MESSAGE);
        }

        if (unit.space) {
          await tx.space.delete({ where: { id: unit.space.id } });
        }

        await tx.orgUnit.delete({ where: { id: orgUnitId } });
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(CHANGED_MESSAGE);
      }

      throw error;
    }
  }
}
