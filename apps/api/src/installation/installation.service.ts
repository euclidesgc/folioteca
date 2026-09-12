import { createHash, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AUTH_INSTANCE } from "../auth/auth.constants";
import type { Auth } from "../auth/auth.factory";
import type { EnvironmentVariables } from "../config/environment-variables";
import {
  InstallationAlreadyDoneError,
  InstallationCodeInvalidError,
} from "./installation.errors";
import { InstallationRepository } from "./installation.repository";
import type { InstallationDto } from "./dto/installation.dto";
import type { OrganizationStatusDto } from "./dto/organization-status.dto";

export type InstallResult = {
  cookie: string;
};

// motivo: compara o digest, não o valor — `timingSafeEqual` exige buffers do
// mesmo tamanho, e comparar os valores recebidos direto vazaria o
// comprimento do código certo pelo tempo de resposta.
function codeMatches(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

@Injectable()
export class InstallationService {
  constructor(
    @Inject(AUTH_INSTANCE) private readonly auth: Auth,
    private readonly repository: InstallationRepository,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async getStatus(): Promise<OrganizationStatusDto> {
    const installed = await this.repository.exists();
    if (!installed) {
      return { status: "SETUP_PENDING" };
    }
    const name = await this.repository.getRootUnitName();
    return { status: "READY", name: name ?? undefined };
  }

  async install(dto: InstallationDto): Promise<InstallResult> {
    this.verifyCode(dto.installationCode);

    if (await this.repository.exists()) {
      throw new InstallationAlreadyDoneError();
    }

    const context = await this.auth.$context;
    const passwordHash = await context.password.hash(dto.password);

    try {
      await this.repository.install({
        organizationName: dto.organizationName,
        adminName: dto.name,
        email: dto.email,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new InstallationAlreadyDoneError();
      }
      throw error;
    }

    const { headers } = await this.auth.api.signInEmail({
      body: { email: dto.email, password: dto.password },
      returnHeaders: true,
    });
    const cookie = headers.get("set-cookie");
    if (!cookie) {
      throw new Error("auth.api.signInEmail não devolveu Set-Cookie.");
    }

    return { cookie };
  }

  private verifyCode(received: string): void {
    const expected = this.config.get("INSTALLATION_CODE", { infer: true });
    if (!codeMatches(received, expected)) {
      throw new InstallationCodeInvalidError();
    }
  }
}
