import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type OrganizationRef = { id: string; name: string };
export type UnitMembershipRef = { id: string; name: string; path: string[] };

type MembershipPathRow = {
  unitId: string;
  unitName: string;
  ancestorName: string;
  depth: number;
};

@Injectable()
export class MeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizationRef(): Promise<OrganizationRef | null> {
    const [organization, root] = await Promise.all([
      this.prisma.organization.findFirst({ select: { id: true } }),
      this.prisma.unit.findFirst({ where: { isRoot: true }, select: { name: true } }),
    ]);
    if (!organization || !root) {
      return null;
    }
    return { id: organization.id, name: root.name };
  }

  // motivo (M5/D2): o caminho até a raiz vem de `UnitClosure` — uma linha por
  // ancestral de cada unidade onde a pessoa está lotada, ordenada da raiz
  // (maior profundidade) até a própria unidade (depth 0), que o gatilho de
  // inserção sempre grava.
  async findUnitsWithPath(userId: string): Promise<UnitMembershipRef[]> {
    const rows = await this.prisma.$queryRaw<MembershipPathRow[]>`
      SELECT m."unitId" AS "unitId", u."name" AS "unitName", a."name" AS "ancestorName", c."depth" AS "depth"
      FROM "UnitMembership" m
      JOIN "Unit" u ON u."id" = m."unitId"
      JOIN "UnitClosure" c ON c."descendantId" = m."unitId"
      JOIN "Unit" a ON a."id" = c."ancestorId"
      WHERE m."userId" = ${userId}
      ORDER BY m."unitId" ASC, c."depth" DESC
    `;

    const byUnit = new Map<string, UnitMembershipRef>();
    for (const row of rows) {
      const entry = byUnit.get(row.unitId) ?? { id: row.unitId, name: row.unitName, path: [] };
      entry.path.push(row.ancestorName);
      byUnit.set(row.unitId, entry);
    }
    return [...byUnit.values()];
  }
}
