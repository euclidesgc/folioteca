import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrganizationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { singleton: true },
      select: { spacesInheritByDefault: true },
    });
    return organization?.spacesInheritByDefault ?? false;
  }

  async update(spacesInheritByDefault: boolean): Promise<boolean> {
    const organization = await this.prisma.organization.update({
      where: { singleton: true },
      data: { spacesInheritByDefault },
      select: { spacesInheritByDefault: true },
    });
    return organization.spacesInheritByDefault;
  }
}
