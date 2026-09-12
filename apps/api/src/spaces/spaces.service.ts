import { Injectable } from "@nestjs/common";
import type { SpaceKind } from "@prisma/client";
import { AccessRepository } from "../access/access.repository";
import { SpaceNotFoundError } from "./spaces.errors";
import type { SpaceRow } from "./spaces.repository";
import { SpacesRepository } from "./spaces.repository";

export type SpaceTreeView = {
  id: string;
  kind: SpaceKind;
  name: string;
  unitId: string | null;
  restricted: boolean;
  inheritsFromParent: boolean;
  managerId: string | null;
  children: SpaceTreeView[];
};

export type SpacePathEntryView = {
  id: string;
  name: string;
};

export type SpaceDetailView = {
  id: string;
  kind: SpaceKind;
  name: string;
  unitId: string | null;
  parentId: string | null;
  restricted: boolean;
  inheritsFromParent: boolean;
  managerId: string | null;
  path: SpacePathEntryView[];
};

export type SpaceMemberView = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isManager: boolean;
};

// motivo (M12): espaço de unidade e livre aberto valem para todo mundo; só o
// livre restrito depende da audiência — o mesmo predicado serve para podar a
// árvore (Regra 6) e para checar o nó único de `GET /spaces/:id`.
function isVisible(space: SpaceRow, audience: ReadonlySet<string>): boolean {
  if (space.kind === "UNIT") {
    return true;
  }
  if (!space.restricted) {
    return true;
  }
  return audience.has(space.id);
}

function toTreeView(row: SpaceRow, children: SpaceTreeView[]): SpaceTreeView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    unitId: row.unitId,
    restricted: row.restricted,
    inheritsFromParent: row.inheritsFromParent,
    managerId: row.managerId,
    children,
  };
}

// motivo (Regra 6): poda o ramo inteiro no primeiro nó invisível — um espaço
// aberto embaixo de um restrito fora de alcance nunca aparece na árvore,
// porque a pessoa não tem como chegar até ele por aqui.
function buildVisibleForest(
  rows: SpaceRow[],
  audience: ReadonlySet<string>,
): SpaceTreeView[] {
  const childrenByParent = new Map<string | null, SpaceRow[]>();
  for (const row of rows) {
    const siblings = childrenByParent.get(row.parentId) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parentId, siblings);
  }

  function build(row: SpaceRow): SpaceTreeView | null {
    if (!isVisible(row, audience)) {
      return null;
    }
    const children = (childrenByParent.get(row.id) ?? [])
      .map(build)
      .filter((child): child is SpaceTreeView => child !== null);
    return toTreeView(row, children);
  }

  return (childrenByParent.get(null) ?? [])
    .map(build)
    .filter((node): node is SpaceTreeView => node !== null);
}

function buildPath(byId: Map<string, SpaceRow>, id: string): SpacePathEntryView[] {
  const path: SpacePathEntryView[] = [];
  let current = byId.get(id);
  while (current) {
    path.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

@Injectable()
export class SpacesService {
  constructor(
    private readonly repository: SpacesRepository,
    private readonly access: AccessRepository,
  ) {}

  async getTree(userId: string): Promise<SpaceTreeView[]> {
    const [rows, audienceIds] = await Promise.all([
      this.repository.findAll(),
      this.access.getAudienceSpaceIds(userId),
    ]);
    return buildVisibleForest(rows, new Set(audienceIds));
  }

  async getById(userId: string, id: string): Promise<SpaceDetailView> {
    const { row, byId } = await this.findVisible(userId, id);
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      unitId: row.unitId,
      parentId: row.parentId,
      restricted: row.restricted,
      inheritsFromParent: row.inheritsFromParent,
      managerId: row.managerId,
      path: buildPath(byId, row.id),
    };
  }

  async getMembers(userId: string, id: string): Promise<SpaceMemberView[]> {
    const { row } = await this.findVisible(userId, id);
    if (row.kind === "UNIT") {
      // motivo (Regra 1/M8): só quem está lotado diretamente na unidade —
      // lotação em subunidade não conta para o espaço da unidade acima.
      const members = await this.repository.findUnitDirectMembers(row.unitId as string);
      return members.map((member) => ({
        userId: member.id,
        name: member.name,
        email: member.email,
        image: member.image,
        isManager: false,
      }));
    }
    const members = await this.repository.findFreeSpaceMembers(row.id);
    return members.map((member) => ({
      userId: member.id,
      name: member.name,
      email: member.email,
      image: member.image,
      isManager: member.id === row.managerId,
    }));
  }

  private async findVisible(
    userId: string,
    id: string,
  ): Promise<{ row: SpaceRow; byId: Map<string, SpaceRow> }> {
    const [rows, audienceIds] = await Promise.all([
      this.repository.findAll(),
      this.access.getAudienceSpaceIds(userId),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const row = byId.get(id);
    // motivo (M12/Regra 6): 404 tanto para id inexistente quanto para espaço
    // fora da audiência — o servidor nunca revela pela resposta que um
    // espaço restrito existe para quem não o alcança.
    if (!row || !isVisible(row, new Set(audienceIds))) {
      throw new SpaceNotFoundError();
    }
    return { row, byId };
  }
}
