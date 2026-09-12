import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { normalizeName } from "../common/text/normalize-name";
import type { FlatUnitRow, MemberRow } from "./units.repository";
import { UnitsRepository } from "./units.repository";
import {
  RootUnitNotDeletableError,
  UnitNameTakenError,
  UnitNotEmptyError,
  UnitNotFoundError,
  UnitTypeNotFoundError,
  UserNotFoundError,
} from "./units.errors";

export type UnitMemberView = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type UnitTreeView = {
  id: string;
  name: string;
  isRoot: boolean;
  unitType: { id: string; name: string } | null;
  directMembers: UnitMemberView[];
  children: UnitTreeView[];
};

export type UnitView = {
  id: string;
  name: string;
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function buildTree(flat: FlatUnitRow[], members: MemberRow[]): UnitTreeView | null {
  const membersByUnit = new Map<string, UnitMemberView[]>();
  for (const member of members) {
    const list = membersByUnit.get(member.unitId) ?? [];
    list.push({ id: member.id, name: member.name, email: member.email, role: member.role });
    membersByUnit.set(member.unitId, list);
  }

  const nodes = new Map<string, UnitTreeView>();
  let root: UnitTreeView | null = null;

  for (const row of flat) {
    const node: UnitTreeView = {
      id: row.id,
      name: row.name,
      isRoot: row.isRoot,
      unitType: row.unitType,
      directMembers: membersByUnit.get(row.id) ?? [],
      children: [],
    };
    nodes.set(row.id, node);
    if (row.isRoot) {
      root = node;
      continue;
    }
    if (row.parentId) {
      nodes.get(row.parentId)?.children.push(node);
    }
  }

  return root;
}

@Injectable()
export class UnitsService {
  constructor(private readonly repository: UnitsRepository) {}

  async getTree(): Promise<UnitTreeView> {
    const rootId = await this.repository.findRootId();
    if (!rootId) {
      throw new Error("no root unit found — instance not installed");
    }
    const [flat, members] = await Promise.all([
      this.repository.findFlatFromRoot(rootId),
      this.repository.findAllDirectMembers(),
    ]);
    const tree = buildTree(flat, members);
    if (!tree) {
      throw new Error("no root unit found — instance not installed");
    }
    return tree;
  }

  async create(name: string, parentId: string, unitTypeId: string): Promise<UnitView> {
    const [parent, unitType] = await Promise.all([
      this.repository.exists(parentId),
      this.repository.unitTypeExists(unitTypeId),
    ]);
    if (!parent) {
      throw new UnitNotFoundError();
    }
    if (!unitType) {
      throw new UnitTypeNotFoundError();
    }
    try {
      return await this.repository.create(name, normalizeName(name), parentId, unitTypeId);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new UnitNameTakenError();
      }
      throw error;
    }
  }

  async rename(id: string, name: string): Promise<UnitView> {
    try {
      const updated = await this.repository.rename(id, name, normalizeName(name));
      if (!updated) {
        throw new UnitNotFoundError();
      }
      return updated;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new UnitNameTakenError();
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const unit = await this.repository.exists(id);
    if (!unit) {
      throw new UnitNotFoundError();
    }
    if (unit.isRoot) {
      throw new RootUnitNotDeletableError();
    }
    const [children, members] = await Promise.all([
      this.repository.countChildren(id),
      this.repository.countDirectMembers(id),
    ]);
    if (children > 0 || members > 0) {
      throw new UnitNotEmptyError();
    }
    await this.repository.delete(id);
  }

  async addMember(unitId: string, userId: string): Promise<void> {
    const [unit, user] = await Promise.all([
      this.repository.exists(unitId),
      this.repository.userExists(userId),
    ]);
    if (!unit) {
      throw new UnitNotFoundError();
    }
    if (!user) {
      throw new UserNotFoundError();
    }
    await this.repository.addMember(unitId, userId);
  }

  // motivo (M6): PUT e DELETE em `/units/:id/members/:userId` são
  // idempotentes — desalojar quem já não está lotado é sucesso, não erro. Só
  // a unidade precisa existir para a chamada fazer sentido.
  async removeMember(unitId: string, userId: string): Promise<void> {
    const unit = await this.repository.exists(unitId);
    if (!unit) {
      throw new UnitNotFoundError();
    }
    await this.repository.removeMember(unitId, userId);
  }
}
