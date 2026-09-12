import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { AUTH_INSTANCE } from "../auth/auth.constants";
import type { Auth } from "../auth/auth.factory";
import type { EnvironmentVariables } from "../config/environment-variables";
import { parseWebOrigins } from "../config/web-origins";
import { MailService } from "../mail/mail.service";
import {
  InvitationInvalidError,
  InvitationNotFoundError,
  InvitationNotPendingError,
  InvitationPendingError,
  UnitNotFoundError,
  UserAlreadyExistsError,
} from "./errors";
import { INVITATION_EMAIL_SUBJECT, renderInvitationEmail } from "./invitation-email";
import { InvitationsRepository, type InvitationRecord } from "./invitations.repository";
import { maskEmail } from "./mask-email";

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

export type PublicInvitationView = {
  organizationName: string;
  unitName: string;
  maskedEmail: string;
  expiresAt: Date;
};

export type AcceptedInvitationResult = {
  cookie: string;
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

function isExpired(invitation: InvitationRecord): boolean {
  return invitation.expiresAt.getTime() <= Date.now();
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly repository: InvitationsRepository,
    private readonly mail: MailService,
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

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

    const token = generateToken();
    const created = await this.repository.create({
      email,
      unitId,
      role,
      tokenHash: hashToken(token),
      expiresAt: newExpiryDate(),
      invitedById,
    });
    await this.sendInvitationEmail(created, token);
    return toView(created);
  }

  async list(): Promise<InvitationView[]> {
    const records = await this.repository.listPending();
    return records.map(toView);
  }

  async resend(id: string): Promise<InvitationView> {
    const invitation = await this.findPendingOrThrow(id);
    const token = generateToken();
    const updated = await this.repository.resend(invitation.id, hashToken(token), newExpiryDate());
    await this.sendInvitationEmail(updated, token);
    return toView(updated);
  }

  async revoke(id: string): Promise<void> {
    const invitation = await this.findPendingOrThrow(id);
    await this.repository.revoke(invitation.id);
  }

  // motivo (regra 8): token errado, vencido, usado ou revogado devolvem o
  // mesmo 404 — só depois de confirmar que o convite está pendente e dentro
  // da validade é que os dados seguem para a tela pública.
  async getPublicView(token: string): Promise<PublicInvitationView> {
    const invitation = await this.findValidByTokenOrThrow(token);
    const organizationName = await this.repository.findOrganizationName();
    return {
      organizationName,
      unitName: invitation.unitName,
      maskedEmail: maskEmail(invitation.email),
      expiresAt: invitation.expiresAt,
    };
  }

  // motivo (D5/regra 9/regra 10): a pessoa, a conta local e a lotação nascem
  // numa transação só no repositório; a sessão nasce depois, por
  // `auth.api.signInEmail`, porque só ela produz o `Set-Cookie` que autentica
  // quem acabou de aceitar sem passo de confirmação de e-mail.
  async accept(token: string, name: string, password: string): Promise<AcceptedInvitationResult> {
    const invitation = await this.findValidByTokenOrThrow(token);

    const context = await this.auth.$context;
    const passwordHash = await context.password.hash(password);

    const accepted = await this.repository.acceptInvitation({
      invitationId: invitation.id,
      unitId: invitation.unitId,
      role: invitation.role,
      email: invitation.email,
      name,
      passwordHash,
    });
    if (!accepted) {
      throw new InvitationInvalidError();
    }

    const { headers } = await this.auth.api.signInEmail({
      body: { email: invitation.email, password },
      returnHeaders: true,
    });
    const cookie = headers.get("set-cookie");
    if (!cookie) {
      throw new Error("auth.api.signInEmail não devolveu Set-Cookie.");
    }
    return { cookie };
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

  private async findValidByTokenOrThrow(token: string): Promise<InvitationRecord> {
    const invitation = await this.repository.findByTokenHash(hashToken(token));
    if (!invitation || !isPending(invitation) || isExpired(invitation)) {
      throw new InvitationInvalidError();
    }
    return invitation;
  }

  private async sendInvitationEmail(invitation: InvitationRecord, token: string): Promise<void> {
    const organizationName = await this.repository.findOrganizationName();
    const acceptUrl = `${this.webOrigin()}/convite/${token}`;
    const { html, text } = await renderInvitationEmail({
      invitedByName: invitation.invitedByName,
      organizationName,
      unitName: invitation.unitName,
      acceptUrl,
    });
    await this.mail.send({
      to: invitation.email,
      subject: INVITATION_EMAIL_SUBJECT,
      text,
      html,
    });
  }

  private webOrigin(): string {
    const [origin] = parseWebOrigins(this.config.get("WEB_ORIGIN", { infer: true }));
    return origin ?? "";
  }
}
