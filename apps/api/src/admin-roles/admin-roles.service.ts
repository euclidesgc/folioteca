import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { DomainNotFoundException } from '../common/domain-not-found.exception';
import { PrismaService } from '../prisma/prisma.service';

type AdminsResponse = components['schemas']['AdminsResponse'];
type AdminResponse = components['schemas']['AdminResponse'];

/**
 * A mensagem é uma só para pessoa inexistente, de outra organização ou com id
 * malformado: a rota não conta quem existe na instância.
 */
export const PERSON_NOT_FOUND_MESSAGE = 'Pessoa não encontrada.';

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

  /** 200 também para quem já administra: promover é idempotente (R5). */
  async promote(
    organizationId: string,
    personId: string,
  ): Promise<AdminResponse> {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, organizationId },
      select: adminFields,
    });

    if (!person) throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);

    await this.prisma.person.updateMany({
      where: { id: personId, organizationId },
      data: { isAdmin: true },
    });

    return { data: person };
  }
}
