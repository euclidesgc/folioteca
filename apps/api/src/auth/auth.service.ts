import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { loginSchema } from './login.schema';
import { PasswordService } from './password.service';
import {
  SessionService,
  toCurrentUser,
  type CreatedSession,
} from './session.service';

type CurrentUser = components['schemas']['CurrentUser'];

/** A mesma resposta para e-mail inexistente e para senha errada. */
const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos.';

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
}
