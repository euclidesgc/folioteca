import { ConflictException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../common/domain-not-found.exception';
import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { orgUnitNotFound } from '../org-units/org-unit-not-found';
import { PrismaService } from '../prisma/prisma.service';
import { assignPersonSchema } from './unit-assignments.schema';

type AssignedPerson = components['schemas']['AssignedPerson'];
type AssignedPeopleResponse = components['schemas']['AssignedPeopleResponse'];

const UNIQUE_VIOLATION = 'P2002';

export const PERSON_NOT_FOUND_MESSAGE = 'Pessoa não encontrada.';

export const ALREADY_ASSIGNED_MESSAGE =
  'Esta pessoa já está lotada nesta unidade.';

/** Campos que descrevem uma pessoa lotada para quem chama a API. */
const personFields = { id: true, name: true, email: true } as const;

/**
 * Sorting in the database would depend on the Postgres collation of each
 * instance ("Álvaro" would come after "Zilda" under `C`), so the order is
 * built in memory with a pt-BR collator.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Reconhece a violação da chave primária composta `(orgUnitId, personId)`. O
 * 409 de lotação repetida nasce só daqui: sem consulta prévia, duas gravações
 * simultâneas não escapam pela brecha entre a consulta e a gravação.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}

@Injectable()
export class UnitAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista quem está lotado na unidade, com a própria unidade no envelope para
   * a página ter o nome dela numa requisição só. Nada aqui olha `parentId`: a
   * raiz é uma unidade como as outras.
   */
  async list(
    organizationId: string,
    orgUnitId: string,
  ): Promise<AssignedPeopleResponse> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const orgUnit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true, name: true },
    });

    if (!orgUnit) {
      throw orgUnitNotFound();
    }

    const rows = await this.prisma.orgUnitAssignment.findMany({
      where: { orgUnitId: orgUnit.id },
      select: { person: { select: personFields } },
    });

    const data = rows
      .map((row) => row.person)
      .sort(
        (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
      );

    return { data, orgUnit: { id: orgUnit.id, name: orgUnit.name } };
  }

  /**
   * Lota a pessoa na unidade. A ordem é fixa: unidade primeiro (404 opaco),
   * corpo depois (400) e pessoa em seguida (404 próprio) — quem não enxerga a
   * unidade nunca recebe 400, senão o formato do corpo contaria que ela
   * existe. A pessoa não passa por `isUuid`: um id malformado simplesmente
   * não é achado, e o resultado é o mesmo 404.
   */
  async assign(
    organizationId: string,
    orgUnitId: string,
    body: unknown,
  ): Promise<AssignedPerson> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const orgUnit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true },
    });

    if (!orgUnit) {
      throw orgUnitNotFound();
    }

    const { personId } = parseBody(assignPersonSchema, body);

    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: personFields,
    });

    if (!person) {
      throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);
    }

    try {
      await this.prisma.orgUnitAssignment.create({
        data: { orgUnitId: orgUnit.id, personId: person.id },
        select: { personId: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(ALREADY_ASSIGNED_MESSAGE);
      }

      throw error;
    }

    return person;
  }

  /**
   * Tira a lotação. A ordem repete a de `assign`: unidade primeiro (404
   * opaco), lotação depois. Não há consulta a `Person`: a linha de lotação só
   * existe se a pessoa existe, então o `deleteMany` decide sozinho — pessoa
   * inexistente, de outra organização, com id malformado e "já não estava
   * lotada" caem todas no mesmo `count === 0`.
   */
  async remove(
    organizationId: string,
    orgUnitId: string,
    personId: string,
  ): Promise<void> {
    if (!isUuid(orgUnitId)) {
      throw orgUnitNotFound();
    }

    const orgUnit = await this.prisma.orgUnit.findFirst({
      where: { id: orgUnitId, organizationId },
      select: { id: true },
    });

    if (!orgUnit) {
      throw orgUnitNotFound();
    }

    const { count } = await this.prisma.orgUnitAssignment.deleteMany({
      where: { orgUnitId: orgUnit.id, personId },
    });

    if (count === 0) {
      throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);
    }
  }
}
