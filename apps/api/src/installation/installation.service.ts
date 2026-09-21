import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { PasswordService } from '../auth/password.service';
import { SessionService, toCurrentUser } from '../auth/session.service';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { createInstallationSchema } from './installation.schema';
import { verifyInstallCode } from './verify-install-code';

type CurrentUser = components['schemas']['CurrentUser'];

/** Token de injeção do código de instalação lido do ambiente. */
export const INSTALL_CODE = 'INSTALL_CODE';

const ALREADY_INSTALLED_MESSAGE = 'Esta instância já foi instalada.';
const REFUSED_MESSAGE =
  'Não foi possível concluir a instalação. Confira os dados informados.';

export type InstallResult = {
  user: CurrentUser;
  token: string;
  expiresAt: Date;
};

function readCode(body: unknown): unknown {
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>).code
    : undefined;
}

@Injectable()
export class InstallationService {
  private readonly logger = new Logger(InstallationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    @Inject(INSTALL_CODE) private readonly installCode: string | undefined,
  ) {}

  async getStatus(): Promise<{ installed: boolean }> {
    const organization = await this.prisma.organization.findFirst({
      select: { id: true },
    });

    return { installed: organization !== null };
  }

  /**
   * Instala a instância: confere o estado, o código e os campos, nessa ordem,
   * e cria organização, unidade raiz, pessoa, espaços e sessão numa transação.
   */
  async install(body: unknown): Promise<InstallResult> {
    const { installed } = await this.getStatus();

    if (installed) {
      throw new ConflictException(ALREADY_INSTALLED_MESSAGE);
    }

    if (this.installCode === undefined) {
      this.logger.warn(
        'INSTALL_CODE não está configurado: a instalação está bloqueada.',
      );
    }

    if (!verifyInstallCode(readCode(body), this.installCode)) {
      throw new ForbiddenException(REFUSED_MESSAGE);
    }

    const data = parseBody(createInstallationSchema, body);
    const passwordHash = await this.passwords.hash(data.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: data.organizationName },
        });

        const rootUnit = await tx.orgUnit.create({
          data: { organizationId: organization.id, name: organization.name },
        });

        const person = await tx.person.create({
          data: {
            organizationId: organization.id,
            name: data.name,
            email: data.email,
            passwordHash,
            isAdmin: true,
          },
        });

        await tx.space.create({
          data: { type: 'PERSONAL', personId: person.id },
        });

        await tx.space.create({
          data: { type: 'UNIT', orgUnitId: rootUnit.id },
        });

        const session = await this.sessions.create(person.id, tx);

        return {
          user: toCurrentUser({ ...person, organization }),
          token: session.token,
          expiresAt: session.expiresAt,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(ALREADY_INSTALLED_MESSAGE);
      }

      throw error;
    }
  }
}
