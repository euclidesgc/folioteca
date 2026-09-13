import { Injectable } from "@nestjs/common";
import type { SpaceKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type SpaceRow = {
  id: string;
  kind: SpaceKind;
  name: string;
  unitId: string | null;
  parentId: string | null;
  restricted: boolean;
  inheritsFromParent: boolean;
  managerId: string | null;
};

export type SpaceMemberRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

const SPACE_SELECT = {
  id: true,
  kind: true,
  name: true,
  unitId: true,
  parentId: true,
  restricted: true,
  inheritsFromParent: true,
  managerId: true,
} as const;

export type CreateSpaceInput = {
  name: string;
  parentId: string | null;
  restricted: boolean;
  managerId: string;
  inheritsFromParent: boolean;
};

export type UpdateSpaceInput = {
  name?: string;
  restricted?: boolean;
};

@Injectable()
export class SpacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<SpaceRow[]> {
    return this.prisma.space.findMany({ select: SPACE_SELECT });
  }

  findById(id: string): Promise<SpaceRow | null> {
    return this.prisma.space.findUnique({ where: { id }, select: SPACE_SELECT });
  }

  countChildren(id: string): Promise<number> {
    return this.prisma.space.count({ where: { parentId: id } });
  }

  async isUnitStaffedDirectly(unitId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.unitMembership.count({ where: { unitId, userId } });
    return count > 0;
  }

  async isFreeSpaceMember(spaceId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.spaceMember.count({ where: { spaceId, userId } });
    return count > 0;
  }

  // motivo (Regra 4): o padrão gravado no nascimento do espaço vem daqui —
  // mudar a configuração da instância depois não reabre espaço já criado.
  async getDefaultInheritance(): Promise<boolean> {
    const organization = await this.prisma.organization.findUnique({
      where: { singleton: true },
      select: { spacesInheritByDefault: true },
    });
    return organization?.spacesInheritByDefault ?? false;
  }

  // motivo (D3): quem cria vira gestor e membro no mesmo ato — as duas
  // escritas nascem juntas, numa transação só.
  async create(input: CreateSpaceInput): Promise<SpaceRow> {
    return this.prisma.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          kind: "FREE",
          name: input.name,
          parentId: input.parentId,
          restricted: input.restricted,
          managerId: input.managerId,
          inheritsFromParent: input.inheritsFromParent,
        },
        select: SPACE_SELECT,
      });
      await tx.spaceMember.create({ data: { spaceId: space.id, userId: input.managerId } });
      return space;
    });
  }

  update(id: string, data: UpdateSpaceInput): Promise<SpaceRow> {
    return this.prisma.space.update({ where: { id }, data, select: SPACE_SELECT });
  }

  updateInheritance(id: string, inheritsFromParent: boolean): Promise<SpaceRow> {
    return this.prisma.space.update({
      where: { id },
      data: { inheritsFromParent },
      select: SPACE_SELECT,
    });
  }

  async userExists(id: string): Promise<boolean> {
    const found = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    return found !== null;
  }

  async addMember(spaceId: string, userId: string): Promise<void> {
    await this.prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId } },
      create: { spaceId, userId },
      update: {},
    });
  }

  async removeMember(spaceId: string, userId: string): Promise<void> {
    await this.prisma.spaceMember.deleteMany({ where: { spaceId, userId } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.space.delete({ where: { id } });
  }

  async findUnitDirectMembers(unitId: string): Promise<SpaceMemberRow[]> {
    const memberships = await this.prisma.unitMembership.findMany({
      where: { unitId },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
    return memberships.map((membership) => membership.user);
  }

  async findFreeSpaceMembers(spaceId: string): Promise<SpaceMemberRow[]> {
    const members = await this.prisma.spaceMember.findMany({
      where: { spaceId },
      select: { user: { select: { id: true, name: true, email: true, image: true } } },
    });
    return members.map((member) => member.user);
  }
}
