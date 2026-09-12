import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
};

export type CreateInvitationInput = {
  email: string;
  unitId: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
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
}
