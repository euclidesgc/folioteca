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

@Injectable()
export class SpacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<SpaceRow[]> {
    return this.prisma.space.findMany({ select: SPACE_SELECT });
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
