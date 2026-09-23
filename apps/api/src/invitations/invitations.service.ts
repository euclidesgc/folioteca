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

/**
 * A única definição de "convite pendente" do servidor: `findPending`, `list`,
 * o `deleteMany` de `create` e `revoke` partem daqui, e é por isso que um
 * estado novo (como `revokedAt`) entra em um lugar só.
 */
export const pendingInvitationWhere = (now: Date = new Date()) =>
  ({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  }) satisfies Prisma.InvitationWhereInput;

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
   * Convite pendente do token, ou `null`. O estado do convite é decidido no
   * banco, por `pendingInvitationWhere`: link inexistente, expirado, já aceito
   * ou revogado chegam aqui como o mesmo `null`, e quem chama monta o mesmo
   * 404 para os quatro.
   */
  private async findPending(token: string): Promise<Invitation | null> {
    const tokenHash = hashToken(token);

    const invitation = await this.prisma.invitation.findFirst({
      where: { tokenHash, ...pendingInvitationWhere() },
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

    return matchesToken ? invitation : null;
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

        // Só o convite pendente do mesmo e-mail sai: o aceito e o revogado
        // ficam como auditoria, e o índice parcial não os enxerga mesmo.
        await tx.invitation.deleteMany({
          where: { email, ...pendingInvitationWhere() },
        });

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
   * Os convites pendentes da organização, do mais recente para o mais antigo,
   * por `pendingInvitationWhere`.
   *
   * O `select` é explícito e não inclui `tokenHash` nem `invitedById`: é a
   * segunda tranca contra vazar o token (a primeira é o schema do contrato).
   */
  async list(organizationId: string): Promise<InvitationListItem[]> {
    const rows = await this.prisma.invitation.findMany({
      where: {
        organizationId,
        ...pendingInvitationWhere(),
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

  /**
   * Marca o convite como revogado, sem apagar a linha: ela continua sendo o
   * registro de que aquele link existiu e foi cortado.
   *
   * `updateMany`, e não uma leitura seguida de escrita: o `where` e a escrita
   * viram uma instrução só, então duas revogações simultâneas não conseguem os
   * dois `count = 1` — a segunda encontra a linha fora do predicado e cai no
   * mesmo 404 de um convite inexistente, de outra organização, já aceito ou
   * vencido. A organização vem sempre de quem está na sessão, nunca da rota.
   */
  async revoke(organizationId: string, invitationId: string): Promise<void> {
    const { count } = await this.prisma.invitation.updateMany({
      where: { id: invitationId, organizationId, ...pendingInvitationWhere() },
      data: { revokedAt: new Date() },
    });

    if (count === 0) {
      throw new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE);
    }
  }
}
