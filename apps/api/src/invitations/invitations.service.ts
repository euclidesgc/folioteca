import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  InvitationNotFoundError,
  InvitationNotPendingError,
  InvitationPendingError,
  UnitNotFoundError,
  UserAlreadyExistsError,
} from "./errors";
import { InvitationsRepository, type InvitationRecord } from "./invitations.repository";

// motivo (regra 5): 7 dias da criação ou do último reenvio; escolha padrão
// registrada em "Riscos e decisões em aberto" do plano.
const INVITATION_DURATION_IN_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type InvitationView = {
  id: string;
  email: string;
  unitId: string;
  unitName: string;
  role: UserRole;
  expiresAt: Date;
  createdAt: Date;
};

function toView(record: InvitationRecord): InvitationView {
  return {
    id: record.id,
    email: record.email,
    unitId: record.unitId,
    unitName: record.unitName,
    role: record.role,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

// motivo: o token é um segredo de uso único — só o hash mora no banco, nunca
// o valor em claro, pelo mesmo padrão de comparação por digest já usado em
// `installation.service.ts`.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function newExpiryDate(): Date {
  return new Date(Date.now() + INVITATION_DURATION_IN_DAYS * MILLISECONDS_PER_DAY);
}

function isPending(invitation: InvitationRecord): boolean {
  return invitation.acceptedAt === null && invitation.revokedAt === null;
}

@Injectable()
export class InvitationsService {
  constructor(private readonly repository: InvitationsRepository) {}

  async create(
    invitedById: string,
    email: string,
    unitId: string,
    role: UserRole,
  ): Promise<InvitationView> {
    const [unitExists, existingUser, pendingInvitation] = await Promise.all([
      this.repository.unitExists(unitId),
      this.repository.findUserByEmail(email),
      this.repository.findPendingByEmail(email),
    ]);
    if (!unitExists) {
      throw new UnitNotFoundError();
    }
    if (existingUser) {
      throw new UserAlreadyExistsError();
    }
    if (pendingInvitation) {
      throw new InvitationPendingError();
    }

    const created = await this.repository.create({
      email,
      unitId,
      role,
      tokenHash: hashToken(generateToken()),
      expiresAt: newExpiryDate(),
      invitedById,
    });
    return toView(created);
  }

  async list(): Promise<InvitationView[]> {
    const records = await this.repository.listPending();
    return records.map(toView);
  }

  async resend(id: string): Promise<InvitationView> {
    const invitation = await this.findPendingOrThrow(id);
    const updated = await this.repository.resend(
      invitation.id,
      hashToken(generateToken()),
      newExpiryDate(),
    );
    return toView(updated);
  }

  async revoke(id: string): Promise<void> {
    const invitation = await this.findPendingOrThrow(id);
    await this.repository.revoke(invitation.id);
  }

  private async findPendingOrThrow(id: string): Promise<InvitationRecord> {
    const invitation = await this.repository.findById(id);
    if (!invitation) {
      throw new InvitationNotFoundError();
    }
    if (!isPending(invitation)) {
      throw new InvitationNotPendingError();
    }
    return invitation;
  }
}
