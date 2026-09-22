import { ConflictException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { orgUnitNotFound } from './org-unit-not-found';
import { createOrgUnitSchema, updateOrgUnitSchema } from './org-units.schema';

type OrgUnit = components['schemas']['OrgUnit'];

const UNIQUE_VIOLATION = 'P2002';

const FOREIGN_KEY_VIOLATION = 'P2003';

const NAME_TAKEN_MESSAGE = 'Já existe uma unidade com esse nome neste nível.';

export const ROOT_MESSAGE = 'A unidade raiz não pode ser apagada.';

export const HAS_CHILDREN_MESSAGE =
  'Apague ou mova as unidades filhas antes de apagar esta unidade.';

export const HAS_DOCUMENTS_MESSAGE =
  'O espaço desta unidade ainda tem documentos, inclusive na lixeira. Trate-os antes de apagar a unidade.';

export const CHANGED_MESSAGE =
  'A unidade mudou enquanto era apagada. Recarregue a estrutura e tente de novo.';

/** Campos que descrevem uma unidade para quem chama a API. */
const orgUnitFields = { id: true, parentId: true, name: true } as const;

/**
 * Reconhece a violação do índice único de nome entre irmãs. O 409 nasce só
 * daqui: sem consulta prévia de duplicidade, duas criações simultâneas com o
 * mesmo nome não escapam pela brecha entre a consulta e a gravação.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
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
      select: { id: true, parentId: true, name: true },
    });

    return [...units].sort(
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

        await tx.space.create({
          data: { type: 'UNIT', orgUnitId: unit.id },
        });

        return unit;
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

        return renamed;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_TAKEN_MESSAGE);
      }

      throw error;
    }
  }

  /**
   * Apaga a unidade e o espaço `UNIT` dela na mesma transação. Uma consulta só
   * traz tudo o que a regra precisa; a recusa segue a ordem raiz → filhas →
   * documentos. A contagem de documentos vai pela relação do espaço (a tabela
   * `Document` é de outro módulo) e **não** filtra `trashedAt`: documento na
   * lixeira também segura a unidade.
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
            _count: { select: { children: true } },
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
