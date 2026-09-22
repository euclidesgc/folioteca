import { ConflictException, Injectable } from '@nestjs/common';
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

/** A frase é do domínio e aparece na tela: o teste assere a constante. */
export const LAST_ADMIN_MESSAGE =
  'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.';

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

  /**
   * 200 também para quem já é membro: tirar o papel é idempotente (R6). A
   * instância nunca fica sem nenhuma administração, e a recusa é 409.
   */
  async demote(
    organizationId: string,
    personId: string,
  ): Promise<AdminResponse> {
    return this.prisma.$transaction(async (tx) => {
      /**
       * Trava toda linha que administra a organização hoje **antes** de
       * contar. Sem o lock, duas transações simultâneas leem cada uma "há
       * duas administrações" e as duas escrevem — é *write skew*, que o
       * `READ COMMITTED` do Postgres não impede porque cada `UPDATE` só
       * tranca a própria linha. Com o lock, a segunda espera aqui, relê
       * depois do commit da primeira e cai no 409. O `ORDER BY "id"` faz
       * duas transações nunca travarem as mesmas linhas em ordens opostas.
       */
      await tx.$queryRaw`SELECT "id" FROM "Person" WHERE "organizationId" = ${organizationId} AND "isAdmin" = true ORDER BY "id" FOR UPDATE`;

      const person = await tx.person.findFirst({
        where: { id: personId, organizationId },
        select: { ...adminFields, isAdmin: true },
      });

      if (!person) throw new DomainNotFoundException(PERSON_NOT_FOUND_MESSAGE);

      if (person.isAdmin) {
        const others = await tx.person.count({
          where: { organizationId, isAdmin: true, id: { not: personId } },
        });

        if (others === 0) throw new ConflictException(LAST_ADMIN_MESSAGE);

        await tx.person.updateMany({
          where: { id: personId, organizationId },
          data: { isAdmin: false },
        });
      }

      const { id, name, email } = person;

      return { data: { id, name, email } };
    });
  }
}
