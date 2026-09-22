import { randomBytes, timingSafeEqual } from 'node:crypto';

import { ConflictException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma, type Invitation } from '@prisma/client';

import { PasswordService } from '../auth/password.service';
import { SessionService, toCurrentUser } from '../auth/session.service';
import { DomainNotFoundException } from '../common/domain-not-found.exception';
import { hashToken } from '../common/hash-token';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import {
  acceptInvitationSchema,
  createInvitationSchema,
} from './invitations.schema';

type CreatedInvitation = components['schemas']['CreatedInvitation'];
type CurrentUser = components['schemas']['CurrentUser'];
type InvitationPreview = components['schemas']['InvitationPreview'];
type InvitationListItem = components['schemas']['Invitation'];

/** O que o aceite devolve ao controller: a mesma forma de `InstallResult`. */
export type AcceptResult = {
  user: CurrentUser;
  token: string;
  expiresAt: Date;
};

/** Um convite vale por sete dias, contados da criação. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = 'P2002';

const LOWER_EMAIL_INDEX = 'Invitation_lower_email_key';

const PERSON_EMAIL_INDEX = 'Person_email_key';

export const ALREADY_A_PERSON_MESSAGE =
  'Esta pessoa já faz parte da organização.';

export const RACE_MESSAGE =
  'Outro convite para este e-mail foi criado ao mesmo tempo. Tente de novo.';

/**
 * Única mensagem de recusa do convite: link inexistente, expirado ou já aceito
 * (e, a partir da 087, revogado) respondem exatamente isto. Quem chama não tem
 * como montar um 404 diferente, e é isso que impede o oráculo.
 */
export const INVITATION_UNAVAILABLE_MESSAGE = 'Convite não encontrado.';

/** Reconhece a violação do `@unique` de `Person.email`. */
function isPersonEmailViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== UNIQUE_VIOLATION
  ) {
    return false;
  }

  // O Prisma entrega `{ modelName: 'Person', target: ['email'] }` para o
  // `@unique` de `Person.email`; o nome do índice aparece quando a violação vem
  // de um índice escrito à mão, como os das migrations deste projeto.
  const meta = JSON.stringify(error.meta ?? {});

  return (
    meta.includes(PERSON_EMAIL_INDEX) ||
    (meta.includes('"Person"') && meta.includes('"email"'))
  );
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Convite pendente do token, ou `null`. Único ponto de recusa: as checagens
   * rodam todas, em memória, sobre a mesma linha já carregada, sem consulta a
   * mais e sem `return` antecipado entre elas — a 087 acrescenta `revokedAt`
   * aqui, e o quarto caso cai no mesmo 404 sem mudar mais nada.
   *
   * "Pendente" é definido aqui e em `list`: `acceptedAt === null` e
   * `expiresAt` no futuro. Aqui roda em memória, sobre uma linha só, para não
   * dar pista de qual das checagens recusou; em `list` roda no banco, porque a
   * lista precisa que o Prisma filtre. A 087 acrescenta `revokedAt` nos dois.
   */
  private async findPending(token: string): Promise<Invitation | null> {
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (invitation === null) {
      return null;
    }

    // A última palavra sobre "é este token mesmo?" não passa por comparação
    // com atalho por prefixo. Os dois buffers têm sempre 32 bytes (sha256).
    const matchesToken = timingSafeEqual(
      Buffer.from(invitation.tokenHash, 'hex'),
      Buffer.from(tokenHash, 'hex'),
    );
    const isValid = invitation.expiresAt.getTime() > Date.now();
    const isUnused = invitation.acceptedAt === null;

    return matchesToken && isValid && isUnused ? invitation : null;
  }

  /** Só o que quem recebeu o link já sabe: o e-mail dele e a organização. */
  async getPreview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findPending(token);

    if (invitation === null) {
      throw new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE);
    }

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: invitation.organizationId },
      select: { name: true },
    });

    return { email: invitation.email, organizationName: organization.name };
  }

  /**
   * Aceita o convite: valida o corpo, confere o convite, calcula o hash da
   * senha fora da transação (argon2id é caro e segurar a transação aberta
   * prenderia conexão à toa) e cria pessoa, espaço pessoal, a marca de aceite
   * e a sessão numa transação só.
   */
  async accept(token: string, body: unknown): Promise<AcceptResult> {
    const data = parseBody(acceptInvitationSchema, body);

    const invitation = await this.findPending(token);

    if (invitation === null) {
      throw new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE);
    }

    const passwordHash = await this.passwords.hash(data.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            organizationId: invitation.organizationId,
            name: data.name,
            email: invitation.email,
            passwordHash,
            isAdmin: false,
          },
        });

        await tx.space.create({
          data: { type: 'PERSONAL', personId: person.id },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        const organization = await tx.organization.findUniqueOrThrow({
          where: { id: invitation.organizationId },
        });

        const session = await this.sessions.create(person.id, tx);

        return {
          user: toCurrentUser({ ...person, organization }),
          token: session.token,
          expiresAt: session.expiresAt,
        };
      });
    } catch (error) {
      if (isPersonEmailViolation(error)) {
        throw new ConflictException(ALREADY_A_PERSON_MESSAGE);
      }

      throw error;
    }
  }

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

  /**
   * Os convites pendentes da organização, do mais recente para o mais
   * antigo. "Pendente" é definido aqui e em `findPending`: `acceptedAt ===
   * null` e `expiresAt` no futuro. Aqui o filtro roda no banco, porque a
   * lista precisa que o Prisma filtre; em `findPending` roda em memória,
   * sobre uma linha só. A 087 acrescenta `revokedAt` nos dois.
   *
   * O `select` é explícito e não inclui `tokenHash` nem `invitedById`: é a
   * segunda tranca contra vazar o token (a primeira é o schema do contrato).
   */
  async list(organizationId: string): Promise<InvitationListItem[]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    });

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  }
}
