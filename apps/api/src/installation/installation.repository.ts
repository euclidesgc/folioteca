import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { normalizeName } from "../common/text/normalize-name";
import { PrismaService } from "../prisma/prisma.service";

const LOCAL_CREDENTIAL_PROVIDER_ID = "credential";
const LOCAL_CREDENTIAL_ISSUER = "local:credential";

export type InstallInput = {
  organizationName: string;
  adminName: string;
  email: string;
  passwordHash: string;
};

export type InstallResult = {
  userId: string;
};

@Injectable()
export class InstallationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async exists(): Promise<boolean> {
    const organization = await this.prisma.organization.findFirst({
      select: { id: true },
    });
    return organization !== null;
  }

  async getRootUnitName(): Promise<string | null> {
    const root = await this.prisma.unit.findFirst({
      where: { isRoot: true },
      select: { name: true },
    });
    return root?.name ?? null;
  }

  // motivo (M2/D5): organização, unidade raiz, primeira administradora,
  // conta local e lotação na raiz nascem numa transação só — a primeira
  // administradora ficaria sem nenhuma lotação se a última escrita falhasse
  // sozinha.
  async install(input: InstallInput): Promise<InstallResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.organization.create({ data: {} });

      const root = await tx.unit.create({
        data: {
          name: input.organizationName,
          normalizedName: normalizeName(input.organizationName),
          isRoot: true,
        },
      });

      const user = await tx.user.create({
        data: {
          name: input.adminName,
          email: input.email,
          emailVerified: true,
          role: UserRole.ADMIN,
        },
      });

      await tx.account.create({
        data: {
          issuer: LOCAL_CREDENTIAL_ISSUER,
          providerId: LOCAL_CREDENTIAL_PROVIDER_ID,
          accountId: user.id,
          password: input.passwordHash,
          userId: user.id,
        },
      });

      await tx.unitMembership.create({
        data: { unitId: root.id, userId: user.id },
      });

      return { userId: user.id };
    });
  }
}
