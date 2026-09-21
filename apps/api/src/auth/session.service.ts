import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { Organization, Person, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { SESSION_TTL_MS } from './session-cookie';

type CurrentUser = components['schemas']['CurrentUser'];

export type PersonWithOrganization = Person & { organization: Organization };

export type CreatedSession = {
  token: string;
  expiresAt: Date;
};

/** Só o hash do token vai para o banco; o token cru fica apenas no cookie. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Corpo público da pessoa da sessão: nunca inclui o hash da senha. */
export function toCurrentUser(person: PersonWithOrganization): CurrentUser {
  return {
    person: {
      id: person.id,
      name: person.name,
      email: person.email,
      isAdmin: person.isAdmin,
    },
    organization: {
      id: person.organization.id,
      name: person.organization.name,
    },
  };
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma sessão opaca para a pessoa. Aceita o cliente de uma transação
   * para a sessão nascer junto com a instalação.
   */
  async create(
    personId: string,
    db?: Prisma.TransactionClient,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await (db ?? this.prisma).session.create({
      data: { tokenHash: hashToken(token), personId, expiresAt },
    });

    return { token, expiresAt };
  }

  /** Pessoa da sessão, ou `null` se o token não existe ou a sessão venceu. */
  async findValid(token: string): Promise<PersonWithOrganization | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { person: { include: { organization: true } } },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session.person;
  }
}
