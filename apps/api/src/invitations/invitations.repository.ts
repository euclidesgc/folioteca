import { Injectable } from "@nestjs/common";
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const LOCAL_CREDENTIAL_PROVIDER_ID = "credential";

export type InvitationRecord = {
  id: string;
  email: string;
  unitId: string;
  unitName: string;
  role: UserRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedByName: string;
};

export type CreateInvitationInput = {
  email: string;
  unitId: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
};

export type AcceptInvitationInput = {
  invitationId: string;
  unitId: string;
  role: UserRole;
  email: string;
  name: string;
  passwordHash: string;
};

export type AcceptInvitationResult = {
  userId: string;
};

const INVITATION_SELECT = {
  id: true,
  email: true,
  unitId: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  unit: { select: { name: true } },
  invitedBy: { select: { name: true } },
} as const;

type InvitationRow = {
  id: string;
  email: string;
  unitId: string;
  role: UserRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  unit: { name: string };
  invitedBy: { name: string };
};

function toRecord(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    email: row.email,
    unitId: row.unitId,
    unitName: row.unit.name,
    role: row.role,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    invitedByName: row.invitedBy.name,
  };
}

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async unitExists(id: string): Promise<boolean> {
    const unit = await this.prisma.unit.findUnique({ where: { id }, select: { id: true } });
    return unit !== null;
  }

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  async findPendingByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.invitation.findFirst({
      where: { email, acceptedAt: null, revokedAt: null },
      select: { id: true },
    });
  }

  async create(input: CreateInvitationInput): Promise<InvitationRecord> {
    const row = await this.prisma.invitation.create({
      data: input,
      select: INVITATION_SELECT,
    });
    return toRecord(row);
  }

  async listPending(): Promise<InvitationRecord[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: INVITATION_SELECT,
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<InvitationRecord | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { id },
      select: INVITATION_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async resend(id: string, tokenHash: string, expiresAt: Date): Promise<InvitationRecord> {
    const row = await this.prisma.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt },
      select: INVITATION_SELECT,
    });
    return toRecord(row);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.invitation.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: INVITATION_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  // motivo (D8): a organização não tem nome próprio — o nome nasce na
  // unidade raiz, única por instância (M1).
  async findOrganizationName(): Promise<string> {
    const root = await this.prisma.unit.findFirstOrThrow({
      where: { isRoot: true },
      select: { name: true },
    });
    return root.name;
  }

  // motivo (D5/regra 9): convite aceito cria `User`, `Account` local e a
  // lotação na unidade do convite numa transação só; a checagem de
  // `acceptedAt`/`revokedAt`/`expiresAt` dentro do `updateMany` fecha a
  // corrida de duas requisições aceitando o mesmo convite ao mesmo tempo —
  // só a primeira marca a linha e segue para criar a pessoa.
  async acceptInvitation(
    input: AcceptInvitationInput,
  ): Promise<AcceptInvitationResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const accepted = await tx.invitation.updateMany({
        where: {
          id: input.invitationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (accepted.count === 0) {
        return null;
      }

      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          emailVerified: true,
          role: input.role,
        },
      });

      await tx.account.create({
        data: {
          issuer: createLocalAccountIssuer(LOCAL_CREDENTIAL_PROVIDER_ID),
          providerId: LOCAL_CREDENTIAL_PROVIDER_ID,
          accountId: user.id,
          password: input.passwordHash,
          userId: user.id,
        },
      });

      await tx.unitMembership.create({
        data: { unitId: input.unitId, userId: user.id },
      });

      return { userId: user.id };
    });
  }
}
