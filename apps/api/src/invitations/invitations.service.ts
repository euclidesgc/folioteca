import { createHash, randomBytes } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { createInvitationSchema } from './invitations.schema';

type CreatedInvitation = components['schemas']['CreatedInvitation'];

/** Um convite vale por sete dias, contados da criação. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = 'P2002';

const LOWER_EMAIL_INDEX = 'Invitation_lower_email_key';

export const ALREADY_A_PERSON_MESSAGE =
  'Esta pessoa já faz parte da organização.';

export const RACE_MESSAGE =
  'Outro convite para este e-mail foi criado ao mesmo tempo. Tente de novo.';

/**
 * Só o hash vai para o banco: o token em claro existe uma única vez, na
 * resposta da criação. É a mesma primitiva usada pelas sessões, duplicada de
 * propósito — convite não é sessão, e o que os dois compartilham é criptografia,
 * não regra de negócio.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Reconhece a violação do índice único por expressão `lower("email")` da
 * migration `0009`: é ele que garante "um convite pendente por e-mail" mesmo
 * quando duas criações simultâneas passam juntas pela remoção do anterior.
 */
function isLowerEmailViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_VIOLATION
  ) {
    return false;
  }

  return JSON.stringify(error.meta ?? {}).includes(LOWER_EMAIL_INDEX);
}

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria o convite e devolve o token em claro uma única vez. Convidar de novo
   * o mesmo e-mail substitui o convite anterior na mesma transação: o hash
   * antigo deixa de existir e o link antigo deixa de valer.
   */
  async create(
    organizationId: string,
    invitedById: string,
    body: unknown,
  ): Promise<CreatedInvitation> {
    const { email } = parseBody(createInvitationSchema, body);

    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.findFirst({
          where: { email },
          select: { id: true },
        });

        if (person) {
          throw new ConflictException(ALREADY_A_PERSON_MESSAGE);
        }

        await tx.invitation.deleteMany({ where: { email } });

        return tx.invitation.create({
          data: { organizationId, email, tokenHash, invitedById, expiresAt },
          select: {
            id: true,
            email: true,
            createdAt: true,
            expiresAt: true,
          },
        });
      });

      return {
        id: created.id,
        email: created.email,
        createdAt: created.createdAt.toISOString(),
        expiresAt: created.expiresAt.toISOString(),
        token,
      };
    } catch (error) {
      if (isLowerEmailViolation(error)) {
        throw new ConflictException(RACE_MESSAGE);
      }

      throw error;
    }
  }
}
