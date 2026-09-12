import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type UnitTypeRecord = {
  id: string;
  name: string;
};

export type DeleteOutcome = "deleted" | "not_found" | "in_use";

@Injectable()
export class UnitTypesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<UnitTypeRecord[]> {
    return this.prisma.unitType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  create(name: string, normalizedName: string): Promise<UnitTypeRecord> {
    return this.prisma.unitType.create({
      data: { name, normalizedName },
      select: { id: true, name: true },
    });
  }

  async update(
    id: string,
    name: string,
    normalizedName: string,
  ): Promise<UnitTypeRecord | null> {
    const existing = await this.prisma.unitType.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }
    return this.prisma.unitType.update({
      where: { id },
      data: { name, normalizedName },
      select: { id: true, name: true },
    });
  }

  async delete(id: string): Promise<DeleteOutcome> {
    const existing = await this.prisma.unitType.findUnique({ where: { id } });
    if (!existing) {
      return "not_found";
    }
    const inUse = await this.prisma.unit.findFirst({
      where: { unitTypeId: id },
      select: { id: true },
    });
    if (inUse) {
      return "in_use";
    }
    await this.prisma.unitType.delete({ where: { id } });
    return "deleted";
  }
}
