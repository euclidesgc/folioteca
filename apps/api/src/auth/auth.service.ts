import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { DocumentPageWidth } from '@prisma/client';

import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { loginSchema } from './login.schema';
import { PasswordService } from './password.service';
import {
  SessionService,
  toCurrentUser,
  type CreatedSession,
} from './session.service';
import type { UpdatePreferencesBody } from './update-preferences.schema';

type CurrentUser = components['schemas']['CurrentUser'];

/** A mesma resposta para e-mail inexistente e para senha errada. */
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos.';

/** Largura da página do contrato (`small`) no enum do banco (`SMALL`). */
const PAGE_WIDTHS: Record<
  UpdatePreferencesBody['documentPageWidth'],
  DocumentPageWidth
> = {
  small: 'SMALL',
  medium: 'MEDIUM',
  large: 'LARGE',
  full: 'FULL',
};

export type LoginResult = {
  user: CurrentUser;
  session: CreatedSession;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Abre a sessão da pessoa. A verificação argon2 acontece sempre, inclusive
   * para e-mail inexistente, para o tempo de resposta não revelar quais
   * e-mails existem. A recusa é uma só, sem dizer qual campo falhou.
   */
  async login(body: unknown, currentToken?: string): Promise<LoginResult> {
    const data = parseBody(loginSchema, body);

    const person = await this.prisma.person.findUnique({
      where: { email: data.email },
      include: { organization: true },
    });

    const matches = await this.passwords.verify(
      person?.passwordHash ?? (await this.passwords.getDummyHash()),
      data.password,
    );

    if (!person || !matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (currentToken !== undefined) {
      await this.sessions.revoke(currentToken);
    }

    const session = await this.sessions.create(person.id);

    return { user: toCurrentUser(person), session };
  }

  /** Encerra a sessão do token, se houver. Repetir o logout não é erro. */
  async logout(token?: string): Promise<void> {
    if (token === undefined) {
      return;
    }

    await this.sessions.revoke(token);
  }

  /** Grava as preferências da pessoa e devolve a pessoa da sessão atualizada. */
  async updatePreferences(
    personId: string,
    body: UpdatePreferencesBody,
  ): Promise<CurrentUser> {
    const person = await this.prisma.person.update({
      where: { id: personId },
      data: { documentPageWidth: PAGE_WIDTHS[body.documentPageWidth] },
      include: { organization: true },
    });

    return toCurrentUser(person);
  }
}
