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

const NAME_TAKEN_MESSAGE = 'Já existe uma unidade com esse nome neste nível.';

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
}
