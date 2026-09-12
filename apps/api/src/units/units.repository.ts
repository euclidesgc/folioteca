import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type FlatUnitRow = {
  id: string;
  name: string;
  isRoot: boolean;
  parentId: string | null;
  unitType: { id: string; name: string } | null;
};

export type MemberRow = {
  unitId: string;
  id: string;
  name: string;
  email: string;
  role: string;
};

type FlatUnitQueryRow = {
  id: string;
  name: string;
  isRoot: boolean;
  parentId: string | null;
  unitTypeId: string | null;
  unitTypeName: string | null;
};

@Injectable()
export class UnitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRootId(): Promise<string | null> {
    const root = await this.prisma.unit.findFirst({
      where: { isRoot: true },
      select: { id: true },
    });
    return root?.id ?? null;
  }

  // motivo: a ordem por profundidade (M5/D2) garante que, ao montar a árvore
  // em memória, o pai de cada unidade já foi visto antes dela.
  async findFlatFromRoot(rootId: string): Promise<FlatUnitRow[]> {
    const rows = await this.prisma.$queryRaw<FlatUnitQueryRow[]>`
      SELECT u."id", u."name", u."isRoot", u."parentId", u."unitTypeId", t."name" AS "unitTypeName"
      FROM "UnitClosure" c
      JOIN "Unit" u ON u."id" = c."descendantId"
      LEFT JOIN "UnitType" t ON t."id" = u."unitTypeId"
      WHERE c."ancestorId" = ${rootId}
      ORDER BY c."depth" ASC
    `;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isRoot: row.isRoot,
      parentId: row.parentId,
      unitType: row.unitTypeId ? { id: row.unitTypeId, name: row.unitTypeName ?? "" } : null,
    }));
  }

  async findAllDirectMembers(): Promise<MemberRow[]> {
    const memberships = await this.prisma.unitMembership.findMany({
      select: {
        unitId: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    return memberships.map((membership) => ({
      unitId: membership.unitId,
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.user.role,
    }));
  }

  async exists(id: string): Promise<{ isRoot: boolean } | null> {
    return this.prisma.unit.findUnique({ where: { id }, select: { isRoot: true } });
  }

  async unitTypeExists(id: string): Promise<boolean> {
    const found = await this.prisma.unitType.findUnique({ where: { id }, select: { id: true } });
    return found !== null;
  }

  async userExists(id: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    return found !== null;
  }

  create(
    name: string,
    normalizedName: string,
    parentId: string,
    unitTypeId: string,
  ): Promise<{ id: string; name: string }> {
    return this.prisma.unit.create({
      data: { name, normalizedName, parentId, unitTypeId },
      select: { id: true, name: true },
    });
  }

  async rename(id: string, name: string, normalizedName: string): Promise<{ id: string; name: string } | null> {
    const existing = await this.prisma.unit.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return null;
    }
    return this.prisma.unit.update({
      where: { id },
      data: { name, normalizedName },
      select: { id: true, name: true },
    });
  }

  async countChildren(id: string): Promise<number> {
    return this.prisma.unit.count({ where: { parentId: id } });
  }

  async countDirectMembers(id: string): Promise<number> {
    return this.prisma.unitMembership.count({ where: { unitId: id } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.unit.delete({ where: { id } });
  }

  async addMember(unitId: string, userId: string): Promise<void> {
    await this.prisma.unitMembership.upsert({
      where: { unitId_userId: { unitId, userId } },
      create: { unitId, userId },
      update: {},
    });
  }

  async removeMember(unitId: string, userId: string): Promise<void> {
    await this.prisma.unitMembership.deleteMany({ where: { unitId, userId } });
  }
}
