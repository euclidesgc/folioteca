import { Injectable } from '@nestjs/common';
import type { Prisma, ShareLevel, SpaceType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { canEdit, type AccessLevel } from './access-level';
import { reachedUnitSpaces, type ReachedUnitSpace } from './unit-reach';

/** What `reachedUnitSpaces` needs from each unit, read in a single query. */
const REACH_UNIT_SELECT = (personId: string) =>
  ({
    id: true,
    parentId: true,
    name: true,
    space: { select: { id: true, inheritsParent: true } },
    assignments: { where: { personId }, select: { personId: true } },
  }) satisfies Prisma.OrgUnitSelect;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** O que uma decisão de acesso precisa saber sobre o documento. */
type DocumentDecision = {
  ownerId: string;
  trashedAt: Date | null;
  shareLevel: 'view' | 'edit' | null;
  /**
   * Nível que a participação no espaço do documento dá: `'edit'` para quem é
   * lotada diretamente na unidade dona do espaço ou que a alcança pela
   * herança da unidade-pai (`UNIT`), ou dona do espaço
   * livre (`FREE`); o nível do membro no espaço livre; `null` para quem não
   * participa.
   */
  spaceLevel: 'edit' | 'view' | null;
  /**
   * Nível do compartilhamento com todos da organização, só quando a pessoa
   * pertence à organização do dono; `null` sem compartilhamento ou para quem
   * está fora dela. Nunca dá `'owner'`.
   */
  instanceLevel: 'view' | 'edit' | null;
};

/**
 * Nível que a participação no espaço dá: lotação direta na unidade (`UNIT`)
 * ou ser dona do espaço livre (`FREE`) valem `'edit'`; membro do espaço livre
 * vale o nível dele; qualquer outro caso, `null`.
 */
function spaceLevelOf(
  space: {
    type: SpaceType;
    ownerId: string | null;
    orgUnit: { assignments: unknown[] } | null;
    members: { level: ShareLevel }[];
  },
  personId: string,
): 'edit' | 'view' | null {
  if (space.type === 'UNIT') {
    return (space.orgUnit?.assignments.length ?? 0) > 0 ? 'edit' : null;
  }

  if (space.type !== 'FREE') {
    return null;
  }

  if (space.ownerId === personId) {
    return 'edit';
  }

  const member = space.members[0];

  if (member === undefined) {
    return null;
  }

  return member.level === 'EDIT' ? 'edit' : 'view';
}

/**
 * Nível da pessoa sobre o documento já lido. Documento ausente (inexistente
 * ou com id malformado) não dá acesso algum.
 */
function levelOf(
  personId: string,
  document: DocumentDecision | null,
): AccessLevel {
  if (document === null) {
    return 'none';
  }

  if (document.ownerId === personId) {
    // O dono continua `'owner'` na lixeira: é ele quem restaura e apaga.
    return 'owner';
  }

  // Documento na lixeira some para quem não é o dono, mesmo compartilhado:
  // este ramo vem antes do compartilhamento para que ele não passe por cima
  // da lixeira.
  if (document.trashedAt !== null) {
    return 'none';
  }

  // Participar do espaço (lotação direta na unidade, herança da unidade-pai,
  // ou dono ou membro do espaço livre) vale o nível do espaço; a herança entre
  // unidades entra só pelo `spaceLevel`, já calculado em `findDecision`. Vale
  // o maior entre ele, o compartilhamento com a pessoa e o compartilhamento
  // com a organização: `'edit'` vence `'view'`.
  if (
    document.spaceLevel === 'edit' ||
    document.shareLevel === 'edit' ||
    document.instanceLevel === 'edit'
  ) {
    return 'edit';
  }

  return (
    document.spaceLevel ??
    document.shareLevel ??
    document.instanceLevel ??
    'none'
  );
}

/**
 * Decisão de acesso a documento, em três portas: uma para um documento
 * (`resolveAccess`, com `canWrite` respondendo se a gravação está liberada
 * agora) e duas para listas (`readableDocumentsWhere` e
 * `trashedDocumentsWhere`). Todas respondem sempre a mesma coisa;
 * compartilhamento e árvore de unidades vão mudar o corpo delas, não quem as
 * chama.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The unit spaces the person reaches in the organization, directly or by
   * inheritance from the parent unit. The unit tree is read on every call:
   * nothing is stored per person.
   */
  async unitSpacesReachedBy(
    organizationId: string,
    personId: string,
  ): Promise<ReachedUnitSpace[]> {
    const units = await this.prisma.orgUnit.findMany({
      where: { organizationId },
      select: REACH_UNIT_SELECT(personId),
    });

    return reachedUnitSpaces(units);
  }

  /**
   * Same as `unitSpacesReachedBy`, for callers without the organization at
   * hand: the organization is the person's own, resolved in the same query.
   */
  private async unitSpacesReachedByPerson(
    personId: string,
  ): Promise<ReachedUnitSpace[]> {
    const units = await this.prisma.orgUnit.findMany({
      where: { organization: { people: { some: { id: personId } } } },
      select: REACH_UNIT_SELECT(personId),
    });

    return reachedUnitSpaces(units);
  }

  /**
   * Lê uma vez só o que decide o acesso ao documento, com o compartilhamento
   * direto da pessoa, o compartilhamento com a organização do dono (com a
   * pertença da pessoa a ela) e a participação dela no espaço (lotação na
   * unidade, ou dono ou membro do espaço livre) na mesma consulta. Id malformado não chega
   * ao banco e não tem decisão alguma.
   */
  private async findDecision(
    documentId: string,
    personId: string,
  ): Promise<DocumentDecision | null> {
    if (!UUID_PATTERN.test(documentId)) {
      return null;
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId },
      select: {
        ownerId: true,
        trashedAt: true,
        shares: { where: { personId }, select: { level: true } },
        instanceShare: { select: { level: true } },
        owner: {
          select: {
            organization: {
              select: {
                people: { where: { id: personId }, select: { id: true } },
              },
            },
          },
        },
        space: {
          select: {
            id: true,
            type: true,
            ownerId: true,
            inheritsParent: true,
            orgUnit: {
              select: {
                id: true,
                organizationId: true,
                assignments: {
                  where: { personId },
                  select: { personId: true },
                },
              },
            },
            members: { where: { personId }, select: { level: true } },
          },
        },
      },
    });

    if (document === null) {
      return null;
    }

    const share = document.shares[0];
    const { space } = document;
    const shareLevel: DocumentDecision['shareLevel'] =
      share === undefined ? null : share.level === 'EDIT' ? 'edit' : 'view';
    const { instanceShare } = document;
    const instanceLevel: DocumentDecision['instanceLevel'] =
      instanceShare === null ||
      document.owner.organization.people.length === 0
        ? null
        : instanceShare.level === 'EDIT'
          ? 'edit'
          : 'view';
    let spaceLevel = spaceLevelOf(space, personId);

    // Only an heir pays for the unit tree: not the owner, not a trashed
    // document, not an `edit` share (personal or with the instance), not a
    // direct assignment and only when the unit space inherits from the parent.
    if (
      document.ownerId !== personId &&
      document.trashedAt === null &&
      shareLevel !== 'edit' &&
      instanceLevel !== 'edit' &&
      space.type === 'UNIT' &&
      space.orgUnit !== null &&
      space.orgUnit.assignments.length === 0 &&
      space.inheritsParent
    ) {
      const reached = await this.unitSpacesReachedBy(
        space.orgUnit.organizationId,
        personId,
      );

      if (reached.some((unitSpace) => unitSpace.spaceId === space.id)) {
        spaceLevel = 'edit';
      }
    }

    return {
      ownerId: document.ownerId,
      trashedAt: document.trashedAt,
      shareLevel,
      spaceLevel,
      instanceLevel,
    };
  }

  /**
   * Nível de acesso da pessoa ao documento. Documento inexistente, de outra
   * pessoa ou com id malformado devolvem `'none'`, indistinguíveis entre si.
   * Ser administradora não dá acesso a documento alheio. O documento na
   * lixeira continua sendo do dono, que precisa vê-lo para restaurar ou
   * apagar.
   */
  async resolveAccess(
    personId: string,
    documentId: string,
  ): Promise<AccessLevel> {
    return levelOf(personId, await this.findDecision(documentId, personId));
  }

  /**
   * Se a pessoa pode gravar título ou conteúdo do documento agora. Documento
   * na lixeira é somente leitura, inclusive para o dono, que ainda o vê como
   * `'owner'` para restaurar ou apagar.
   */
  async canWrite(personId: string, documentId: string): Promise<boolean> {
    const document = await this.findDecision(documentId, personId);

    return canEdit(levelOf(personId, document)) && document?.trashedAt === null;
  }

  /**
   * Filtro dos documentos que a pessoa pode ler. Única fonte para listas: o
   * que está na lixeira fica de fora de todas elas.
   */
  async readableDocumentsWhere(
    personId: string,
  ): Promise<Prisma.DocumentWhereInput> {
    const reachedIds = (await this.unitSpacesReachedByPerson(personId)).map(
      (unitSpace) => unitSpace.spaceId,
    );

    return {
      trashedAt: null,
      OR: [
        { ownerId: personId },
        { shares: { some: { personId } } },
        {
          instanceShare: { isNot: null },
          owner: { organization: { people: { some: { id: personId } } } },
        },
        { spaceId: { in: reachedIds } },
        {
          space: {
            type: 'FREE',
            OR: [{ ownerId: personId }, { members: { some: { personId } } }],
          },
        },
      ],
    };
  }

  /**
   * Filtro dos documentos que a pessoa tem na lixeira. Única expressão de
   * leitura que enxerga `trashedAt` não nulo, e só a do próprio dono.
   */
  trashedDocumentsWhere(personId: string): Prisma.DocumentWhereInput {
    return { ownerId: personId, trashedAt: { not: null } };
  }
}
