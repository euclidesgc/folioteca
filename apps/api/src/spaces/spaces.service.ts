import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { ShareLevel } from '@prisma/client';

import { DomainNotFoundException } from '../common/domain-not-found.exception';
import { isUniqueViolation } from '../common/is-unique-violation';
import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { ptBrCollator } from '../common/pt-br-collator';
import { spaceNotFound } from '../common/space-not-found';
import { PrismaService } from '../prisma/prisma.service';
import {
  createSpaceSchema,
  updateSpaceMemberSchema,
  updateSpaceSchema,
} from './spaces.schema';

type Space = components['schemas']['Space'];
type SpaceResponse = components['schemas']['SpaceResponse'];
type SpacesResponse = components['schemas']['SpacesResponse'];

type SpaceDetail = components['schemas']['SpaceDetail'];
type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];
type SpaceMember = components['schemas']['SpaceMember'];
type SpaceMembersResponse = components['schemas']['SpaceMembersResponse'];
type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];
type SpaceMemberLevelResponse =
  components['schemas']['SpaceMemberLevelResponse'];

const OWNER_ONLY_MESSAGE = 'Só o dono do espaço pode adicionar pessoas.';

const REMOVE_OWNER_ONLY_MESSAGE = 'Só o dono do espaço pode remover pessoas.';

const ADD_OWNER_MESSAGE = 'Você já é o dono deste espaço.';

const MEMBER_ADDS_OWNER_MESSAGE = 'Esta pessoa é a dona deste espaço.';

const MEMBER_ADDS_SELF_MESSAGE = 'Você já é membro deste espaço.';

const SETTINGS_OWNER_ONLY_MESSAGE =
  'Só o dono do espaço pode mudar quem adiciona pessoas.';

const PERSON_NOT_FOUND_MESSAGE = 'Pessoa não encontrada nesta instância.';

const REMOVE_OWNER_MESSAGE = 'O dono não pode ser removido.';

const LEVEL_OWNER_ONLY_MESSAGE =
  'Só o dono do espaço pode mudar o nível de um membro.';

const OWNER_HAS_NO_LEVEL_MESSAGE = 'O dono do espaço não tem nível.';

const NOT_A_MEMBER_MESSAGE = 'Esta pessoa não é membro deste espaço.';

const VIEWER_ADDS_MESSAGE =
  'Só quem pode editar adiciona pessoas a este espaço.';

const DUPLICATE_NAME_MESSAGE = 'Você já tem um espaço com esse nome.';

/** Nível do membro do espaço livre como o contrato o expõe. */
function toMemberLevel(level: ShareLevel): 'view' | 'edit' {
  return level === 'EDIT' ? 'edit' : 'view';
}

type UnitReach = {
  reach: 'direct' | 'inherited' | 'none';
  orgUnitId: string | null;
};

/**
 * Order of the members of a space: the owner of a free space first, then the
 * caller, then by name, then by e-mail, and the id as the last tie-breaker so
 * the order is stable. A unit space has no owner, so its order is unchanged.
 */
export function compareMembers(a: SpaceMember, b: SpaceMember): number {
  if ((a.role === 'owner') !== (b.role === 'owner')) {
    return a.role === 'owner' ? -1 : 1;
  }

  if (a.isCurrentPerson !== b.isCurrentPerson) {
    return a.isCurrentPerson ? -1 : 1;
  }

  return (
    ptBrCollator.compare(a.name, b.name) ||
    ptBrCollator.compare(a.email, b.email) ||
    a.id.localeCompare(b.id)
  );
}

type ReachUnit = {
  id: string;
  parentId: string | null;
  space: { inheritsParent: boolean } | null;
  assignments: unknown[];
};

/**
 * Builds the memoized "does the person reach this unit's space" check. A unit
 * is reached when the person is assigned to it, or when its space inherits
 * and the parent is reached. Resolution is iterative: it climbs the parents
 * stacking the unresolved units and resolves them on the way back, so a deep
 * tree cannot overflow the call stack. A unit revisited within the same climb
 * (a parent cycle) counts as not reached.
 */
function resolveReach(units: ReachUnit[]): (unitId: string) => boolean {
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const memo = new Map<string, boolean>();

  return (unitId) => {
    const pending: ReachUnit[] = [];
    const visited = new Set<string>();
    let current = byId.get(unitId);
    let result = false;

    while (current) {
      const known = memo.get(current.id);
      if (known !== undefined) {
        result = known;
        break;
      }
      if (visited.has(current.id)) {
        result = false;
        break;
      }
      visited.add(current.id);

      if (current.assignments.length > 0) {
        memo.set(current.id, true);
        result = true;
        break;
      }
      if (current.space?.inheritsParent !== true || current.parentId === null) {
        memo.set(current.id, false);
        result = false;
        break;
      }

      pending.push(current);
      current = byId.get(current.parentId);
    }

    for (const unit of pending) {
      memo.set(unit.id, result);
    }

    return memo.get(unitId) ?? result;
  };
}

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * As unidades da organização com o espaço de cada uma e a lotação direta da
   * pessoa: a leitura de que `resolveReach` precisa.
   */
  private findReachUnits(organizationId: string, personId: string) {
    return this.prisma.orgUnit.findMany({
      where: { organizationId },
      select: {
        id: true,
        parentId: true,
        name: true,
        space: { select: { id: true, inheritsParent: true } },
        assignments: { where: { personId }, select: { personId: true } },
      },
    });
  }

  /**
   * Os espaços das unidades que a pessoa alcança e os espaços livres de que
   * ela é dona ou membro, sempre na organização dela. Alcança o espaço de uma unidade
   * quem está lotado nela ou, se o espaço herda da unidade-pai, quem alcança
   * o espaço da mãe (em cadeia, enquanto os espaços herdam). Ser
   * administração não amplia a lista.
   */
  async list(organizationId: string, personId: string): Promise<SpacesResponse> {
    const [freeRows, units] = await Promise.all([
      this.prisma.space.findMany({
        where: {
          type: 'FREE',
          organizationId,
          OR: [{ ownerId: personId }, { members: { some: { personId } } }],
        },
        select: { id: true, name: true },
      }),
      this.findReachUnits(organizationId, personId),
    ]);

    const reaches = resolveReach(units);

    const unitSpaces = units.flatMap((unit): Space[] =>
      unit.space && reaches(unit.id)
        ? [{ id: unit.space.id, type: 'unit', name: unit.name }]
        : [],
    );

    const freeSpaces = freeRows.flatMap((row): Space[] =>
      row.name === null ? [] : [{ id: row.id, type: 'free', name: row.name }],
    );

    const data = [...unitSpaces, ...freeSpaces].sort(
      (a, b) => ptBrCollator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );

    return { data };
  }

  /**
   * Como a pessoa alcança o espaço informado, na organização dela: `'direct'`
   * se é dona ou membro do espaço livre ou se está lotada na unidade do
   * espaço de unidade, `'inherited'` se o alcança só pela herança entre
   * unidades e `'none'` se não o alcança ou se o espaço não existe ou é
   * pessoal.
   */
  async reachOf(
    organizationId: string,
    personId: string,
    spaceId: string,
  ): Promise<'direct' | 'inherited' | 'none'> {
    const freeSpace = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId,
        OR: [{ ownerId: personId }, { members: { some: { personId } } }],
      },
      select: { id: true },
    });

    if (freeSpace !== null) {
      return 'direct';
    }

    const { reach } = await this.reachOfUnit(organizationId, personId, spaceId);

    return reach;
  }

  /**
   * O alcance de `reachOf` junto com a unidade do espaço, para quem precisa
   * ler a unidade depois. `orgUnitId` é `null` quando o espaço não existe ou
   * não é de unidade da organização.
   */
  private async reachOfUnit(
    organizationId: string,
    personId: string,
    spaceId: string,
  ): Promise<UnitReach> {
    const space = await this.prisma.space.findFirst({
      where: { id: spaceId, type: 'UNIT', orgUnit: { organizationId } },
      select: {
        orgUnit: {
          select: {
            id: true,
            assignments: { where: { personId }, select: { personId: true } },
          },
        },
      },
    });

    if (space === null || space.orgUnit === null) {
      return { reach: 'none', orgUnitId: null };
    }

    const orgUnitId = space.orgUnit.id;

    if (space.orgUnit.assignments.length > 0) {
      return { reach: 'direct', orgUnitId };
    }

    const units = await this.findReachUnits(organizationId, personId);

    return {
      reach: resolveReach(units)(orgUnitId) ? 'inherited' : 'none',
      orgUnitId,
    };
  }

  /**
   * O espaço informado com a forma de alcance de quem pede. Espaço livre só
   * para o dono (`owner`) e os membros (`member`); espaço de unidade para quem a alcança direto ou
   * por herança. Qualquer outro caso (inexistente, pessoal, livre de outra
   * pessoa, sem alcance, outra organização) é `null`. Ser administração não
   * amplia o alcance.
   */
  async getDetail(
    organizationId: string,
    personId: string,
    spaceId: string,
  ): Promise<SpaceDetail | null> {
    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        OR: [
          {
            type: 'FREE',
            organizationId,
            OR: [{ ownerId: personId }, { members: { some: { personId } } }],
          },
          { type: 'UNIT', orgUnit: { organizationId } },
        ],
      },
      select: {
        id: true,
        type: true,
        name: true,
        ownerId: true,
        membersCanInvite: true,
        orgUnit: { select: { id: true, name: true } },
        members: { where: { personId }, select: { level: true } },
      },
    });

    if (space === null) {
      return null;
    }

    if (space.type === 'FREE') {
      if (space.name === null) {
        return null;
      }

      const isOwner = space.ownerId === personId;
      const isEditor = isOwner || space.members[0]?.level === 'EDIT';

      return {
        id: space.id,
        type: 'free',
        name: space.name,
        reach: isOwner ? 'owner' : 'member',
        membersCanInvite: space.membersCanInvite,
        canCreateDocuments: isEditor,
        canAddPeople: isOwner || (isEditor && space.membersCanInvite),
      };
    }

    if (space.orgUnit === null) {
      return null;
    }

    const { reach } = await this.reachOfUnit(organizationId, personId, spaceId);

    if (reach === 'none') {
      return null;
    }

    return {
      id: space.id,
      type: 'unit',
      name: space.orgUnit.name,
      reach,
      membersCanInvite: false,
      canCreateDocuments: reach === 'direct',
      canAddPeople: false,
    };
  }

  /**
   * Muda quem adiciona pessoas ao espaço livre; só o dono muda. O acesso é
   * conferido antes do corpo, para quem não é dono não descobrir a forma do
   * recurso: 404 (malformado, de unidade, pessoal, alheio ou de outra
   * organização) → 403 (membro) → 400 (corpo). Repetir o mesmo valor é
   * idempotente. Organização e quem pede chegam só da sessão.
   */
  async updateSettings(
    requester: { organizationId: string; id: string },
    spaceId: string,
    body: unknown,
  ): Promise<SpaceDetailResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId: requester.organizationId,
        OR: [
          { ownerId: requester.id },
          { members: { some: { personId: requester.id } } },
        ],
      },
      select: { ownerId: true },
    });

    if (space === null) {
      throw spaceNotFound();
    }

    if (space.ownerId !== requester.id) {
      throw new ForbiddenException(SETTINGS_OWNER_ONLY_MESSAGE);
    }

    const { membersCanInvite } = parseBody(updateSpaceSchema, body);

    await this.prisma.space.update({
      where: { id: spaceId },
      data: { membersCanInvite },
    });

    const detail = await this.getDetail(
      requester.organizationId,
      requester.id,
      spaceId,
    );

    if (detail === null) {
      throw spaceNotFound();
    }

    return { data: detail };
  }

  /**
   * As pessoas do espaço, na ordem de `compareMembers`. Espaço livre: o dono
   * e os membros, só para o dono e os membros. Espaço de unidade: as pessoas
   * lotadas diretamente na unidade, para quem alcança o espaço direto ou por
   * herança. Espaço sem alcance, pessoal, inexistente ou de outra organização
   * é `null`.
   */
  async listMembers(
    organizationId: string,
    personId: string,
    spaceId: string,
  ): Promise<SpaceMembersResponse | null> {
    const freeSpace = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId,
        OR: [{ ownerId: personId }, { members: { some: { personId } } }],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: {
            person: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (freeSpace !== null) {
      const owner = freeSpace.owner;
      const ownerRow: SpaceMember[] =
        owner === null
          ? []
          : [
              {
                id: owner.id,
                name: owner.name,
                email: owner.email,
                isCurrentPerson: owner.id === personId,
                role: 'owner',
                level: null,
              },
            ];
      const memberRows = freeSpace.members.map(
        ({ person, level }): SpaceMember => ({
          id: person.id,
          name: person.name,
          email: person.email,
          isCurrentPerson: person.id === personId,
          role: 'member',
          level: toMemberLevel(level),
        }),
      );

      return { data: [...ownerRow, ...memberRows].sort(compareMembers) };
    }

    const { reach, orgUnitId } = await this.reachOfUnit(
      organizationId,
      personId,
      spaceId,
    );

    if (reach === 'none' || orgUnitId === null) {
      return null;
    }

    const assignments = await this.prisma.orgUnitAssignment.findMany({
      where: { orgUnitId },
      select: { person: { select: { id: true, name: true, email: true } } },
    });

    const data = assignments
      .map(({ person }): SpaceMember => ({
        id: person.id,
        name: person.name,
        email: person.email,
        isCurrentPerson: person.id === personId,
        role: 'assigned',
        level: null,
      }))
      .sort(compareMembers);

    return { data };
  }

  /**
   * Adiciona a pessoa como membro do espaço livre; o dono adiciona sempre e
   * um membro só com o espaço aberto (`membersCanInvite`), relido a cada
   * pedido. O espaço é conferido antes da pessoa, para uma pessoa inválida não revelar
   * que um espaço alheio existe. Repetir para a mesma pessoa não cria uma
   * segunda linha. Organização e quem pede chegam só da sessão.
   */
  async addMember(
    requester: { organizationId: string; id: string },
    spaceId: string,
    personId: string,
  ): Promise<SpaceMemberResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId: requester.organizationId,
        OR: [
          { ownerId: requester.id },
          { members: { some: { personId: requester.id } } },
        ],
      },
      select: {
        ownerId: true,
        membersCanInvite: true,
        members: {
          where: { personId: requester.id },
          select: { level: true },
        },
      },
    });

    if (space === null) {
      throw spaceNotFound();
    }

    const isOwner = space.ownerId === requester.id;

    if (!isOwner && !space.membersCanInvite) {
      throw new ForbiddenException(OWNER_ONLY_MESSAGE);
    }

    if (!isOwner && space.members[0]?.level === 'VIEW') {
      throw new ForbiddenException(VIEWER_ADDS_MESSAGE);
    }

    if (!isOwner && personId === space.ownerId) {
      throw new BadRequestException(MEMBER_ADDS_OWNER_MESSAGE);
    }

    if (!isOwner && personId === requester.id) {
      throw new BadRequestException(MEMBER_ADDS_SELF_MESSAGE);
    }

    if (personId === space.ownerId) {
      throw new BadRequestException(ADD_OWNER_MESSAGE);
    }

    const person = isUuid(personId)
      ? await this.prisma.person.findFirst({
          where: { id: personId, organizationId: requester.organizationId },
          select: { id: true, name: true, email: true },
        })
      : null;

    if (person === null) {
      throw new BadRequestException(PERSON_NOT_FOUND_MESSAGE);
    }

    await this.prisma.spaceMember.upsert({
      where: { spaceId_personId: { spaceId, personId } },
      create: { spaceId, personId },
      update: {},
    });

    return { data: { id: person.id, name: person.name, email: person.email } };
  }

  /**
   * Muda o nível de um membro do espaço livre; só o dono muda. O acesso é
   * conferido antes do corpo e da pessoa, para quem não é dono não descobrir
   * a forma do recurso: 404 (malformado, de unidade, pessoal, alheio ou de
   * outra organização) → 403 (membro) → 400 (o dono como alvo, corpo) → 404
   * (quem não é membro). Repetir o mesmo nível é idempotente. Organização e
   * quem pede chegam só da sessão.
   */
  async updateMemberLevel(
    requester: { organizationId: string; id: string },
    spaceId: string,
    personId: string,
    body: unknown,
  ): Promise<SpaceMemberLevelResponse> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId: requester.organizationId,
        OR: [
          { ownerId: requester.id },
          { members: { some: { personId: requester.id } } },
        ],
      },
      select: { ownerId: true },
    });

    if (space === null) {
      throw spaceNotFound();
    }

    if (space.ownerId !== requester.id) {
      throw new ForbiddenException(LEVEL_OWNER_ONLY_MESSAGE);
    }

    if (personId === space.ownerId) {
      throw new BadRequestException(OWNER_HAS_NO_LEVEL_MESSAGE);
    }

    const { level } = parseBody(updateSpaceMemberSchema, body);

    const member = isUuid(personId)
      ? await this.prisma.spaceMember.findUnique({
          where: { spaceId_personId: { spaceId, personId } },
          select: { person: { select: { id: true, name: true, email: true } } },
        })
      : null;

    if (member === null) {
      throw new DomainNotFoundException(NOT_A_MEMBER_MESSAGE);
    }

    const updated = await this.prisma.spaceMember.update({
      where: { spaceId_personId: { spaceId, personId } },
      data: { level: level === 'view' ? 'VIEW' : 'EDIT' },
      select: { level: true },
    });

    return {
      data: {
        id: member.person.id,
        name: member.person.name,
        email: member.person.email,
        isCurrentPerson: false,
        role: 'member',
        level: toMemberLevel(updated.level),
      },
    };
  }

  /**
   * Remove a pessoa dos membros do espaço livre; só o dono remove. O espaço é
   * conferido antes da pessoa, como em `addMember`. Remover quem não é membro
   * (ou um id malformado) não faz nada, e repetir é idempotente. Organização e
   * quem pede chegam só da sessão.
   */
  async removeMember(
    requester: { organizationId: string; id: string },
    spaceId: string,
    personId: string,
  ): Promise<void> {
    if (!isUuid(spaceId)) {
      throw spaceNotFound();
    }

    const space = await this.prisma.space.findFirst({
      where: {
        id: spaceId,
        type: 'FREE',
        organizationId: requester.organizationId,
        OR: [
          { ownerId: requester.id },
          { members: { some: { personId: requester.id } } },
        ],
      },
      select: { ownerId: true },
    });

    if (space === null) {
      throw spaceNotFound();
    }

    if (space.ownerId !== requester.id) {
      throw new ForbiddenException(REMOVE_OWNER_ONLY_MESSAGE);
    }

    if (personId === space.ownerId) {
      throw new BadRequestException(REMOVE_OWNER_MESSAGE);
    }

    if (!isUuid(personId)) {
      return;
    }

    await this.prisma.spaceMember.deleteMany({ where: { spaceId, personId } });
  }

  /**
   * Cria um espaço livre com a pessoa da sessão como dona. Organização e dona
   * chegam só por parâmetro (da sessão); o corpo aceita apenas o nome.
   */
  async create(
    organizationId: string,
    personId: string,
    body: unknown,
  ): Promise<SpaceResponse> {
    const { name } = parseBody(createSpaceSchema, body);

    const duplicate = await this.prisma.space.findFirst({
      where: {
        type: 'FREE',
        ownerId: personId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(DUPLICATE_NAME_MESSAGE);
    }

    // The query above gives the friendly answer; the partial unique index
    // `Space_free_owner_name_key` closes the race between it and the insert.
    let space: { id: string; name: string | null };

    try {
      space = await this.prisma.space.create({
        data: { type: 'FREE', organizationId, ownerId: personId, name },
        select: { id: true, name: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_NAME_MESSAGE);
      }

      throw error;
    }

    return { data: { id: space.id, type: 'free', name: space.name ?? name } };
  }
}
