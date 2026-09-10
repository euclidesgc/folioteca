import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganizationForUser(
    userId: string,
    organizationName: string,
  ): Promise<void> {
    // motivo: as duas escritas são um ato só — uma organização sem a sua
    // primeira administradora não tem quem a administre, e uma pessoa sem
    // organização não alcança nada no produto.
    await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: organizationName },
      });
      await tx.user.update({
        where: { id: userId },
        data: { organizationId: organization.id, role: UserRole.ADMIN },
      });
    });
  }
}
