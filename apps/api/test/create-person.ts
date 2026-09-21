import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';

import { SESSION_COOKIE_NAME } from '../src/auth/session-cookie';
import { SessionService } from '../src/auth/session.service';
import { PrismaService } from '../src/prisma/prisma.service';

export type CreatePersonInput = {
  name: string;
  email: string;
  isAdmin?: boolean;
  /** Cria o espaço pessoal junto com a pessoa. Padrão: `true`. */
  withPersonalSpace?: boolean;
};

export type CreatedPerson = {
  person: Person;
  cookie: string;
};

/**
 * Cria uma segunda pessoa na organização já instalada, com o espaço pessoal
 * dela, e abre uma sessão. O `passwordHash` é um valor aleatório: esta pessoa
 * nunca entra por senha, e nenhum literal com cara de credencial fica no
 * repositório.
 */
export async function createPersonWithSession(
  app: INestApplication,
  input: CreatePersonInput,
): Promise<CreatedPerson> {
  const prisma = app.get(PrismaService);
  const sessions = app.get(SessionService);

  const organization = await prisma.organization.findFirstOrThrow({
    select: { id: true },
  });

  const person = await prisma.person.create({
    data: {
      organizationId: organization.id,
      name: input.name,
      email: input.email,
      passwordHash: randomUUID(),
      isAdmin: input.isAdmin ?? false,
    },
  });

  if (input.withPersonalSpace ?? true) {
    await prisma.space.create({
      data: { type: 'PERSONAL', personId: person.id },
    });
  }

  const session = await sessions.create(person.id);

  return { person, cookie: `${SESSION_COOKIE_NAME}=${session.token}` };
}
