import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma, type Document as DocumentRecord } from '@prisma/client';

import { canEdit } from '../access/access-level';
import { AccessService } from '../access/access.service';
import type { PersonWithOrganization } from '../auth/session.service';
import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { spaceNotFound } from '../common/space-not-found';
import { PrismaService } from '../prisma/prisma.service';
import { documentNotFound } from './document-not-found';
import {
  createDocumentSchema,
  DEFAULT_DOCUMENT_TITLE,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from './documents.schema';

type Document = components['schemas']['Document'];
type DocumentSummary = components['schemas']['DocumentSummary'];
type AccessLevel = components['schemas']['AccessLevel'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];

const CANNOT_EDIT_MESSAGE =
  'Você não tem permissão para editar este documento.';

export const TRASHED_DOCUMENT_MESSAGE =
  'Este documento está na lixeira. Restaure-o para editar.';

const DELETE_OUTSIDE_TRASH_MESSAGE =
  'Mova o documento para a lixeira antes de apagá-lo definitivamente.';

/**
 * Códigos do Prisma que significam "o documento sumiu no meio da gravação":
 * registro não encontrado (`P2025`) e chave estrangeira violada (`P2003`).
 */
const MISSING_DOCUMENT_CODES = ['P2025', 'P2003'];

function isMissingDocumentError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    MISSING_DOCUMENT_CODES.includes(error.code)
  );
}

/**
 * Registro do documento com os favoritos já filtrados pela pessoa da chamada:
 * a relação vem vazia ou com uma linha só.
 */
type DocumentWithFavorites = DocumentRecord & {
  favorites: { personId: string }[];
};

/**
 * Corpo público do documento: os campos do banco mais o nível de acesso e a
 * marcação de favorito. A relação `favorites` não vaza no corpo.
 */
function toDocument(
  { favorites, ...document }: DocumentWithFavorites,
  accessLevel: AccessLevel,
): Document {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    // Sem a conversão o `Date` do banco vazaria no corpo da resposta.
    trashedAt: document.trashedAt?.toISOString() ?? null,
    accessLevel,
    isFavorite: favorites.length > 0,
  };
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  /**
   * Quem quer saber que um documento deixou de aceitar sessão aberta. O módulo
   * `collab` se inscreve aqui; este serviço não o conhece (o import seria
   * circular).
   */
  private readonly closedListeners: ((documentId: string) => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Cria um documento sem título. Sem `spaceId` no corpo, nasce no espaço
   * pessoal de quem chamou, que nasce junto na mesma transação se ainda não
   * existir. Com `spaceId`, nasce no espaço da unidade em que a pessoa está
   * lotada diretamente, na organização dela; qualquer outro espaço (inclusive
   * o alcançado só por herança) é o mesmo 404 opaco.
   */
  async create(
    person: PersonWithOrganization,
    body: unknown,
  ): Promise<Document> {
    const { spaceId } = parseBody(
      createDocumentSchema,
      body === undefined ? {} : body,
    );

    const document = await this.prisma.$transaction(async (tx) => {
      let targetSpaceId: string;

      if (spaceId === undefined) {
        const space = await tx.space.upsert({
          where: { personId: person.id },
          create: { type: 'PERSONAL', personId: person.id },
          update: {},
        });
        targetSpaceId = space.id;
      } else {
        if (!isUuid(spaceId)) {
          throw spaceNotFound();
        }

        const space = await tx.space.findFirst({
          where: {
            id: spaceId,
            type: 'UNIT',
            orgUnit: {
              organizationId: person.organizationId,
              assignments: { some: { personId: person.id } },
            },
          },
          select: { id: true },
        });

        if (space === null) {
          throw spaceNotFound();
        }
        targetSpaceId = space.id;
      }

      return tx.document.create({
        data: {
          title: DEFAULT_DOCUMENT_TITLE,
          spaceId: targetSpaceId,
          authorId: person.id,
          ownerId: person.id,
        },
      });
    });

    // Documento recém-criado não é favorito de ninguém: nada a consultar.
    return toDocument({ ...document, favorites: [] }, 'owner');
  }

  /** Documentos da pessoa, dos mais recentes para os mais antigos. */
  async listMine(personId: string, query: unknown): Promise<DocumentSummary[]> {
    parseBody(listDocumentsQuerySchema, query);

    const documents = await this.prisma.document.findMany({
      where: {
        AND: [
          this.access.readableDocumentsWhere(personId),
          { ownerId: personId },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, title: true, updatedAt: true },
    });

    // A porta de leitura já deixa a lixeira de fora: nada aqui está nela, e a
    // coluna nem precisa ser selecionada.
    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updatedAt.toISOString(),
      trashedAt: null,
    }));
  }

  /**
   * Documentos que a pessoa pode ler num espaço, dos mais recentes para os
   * mais antigos. Quem pode entrar no espaço é decidido antes, por quem
   * chama; aqui vale só a porta de leitura.
   */
  async listInSpace(
    personId: string,
    spaceId: string,
  ): Promise<DocumentsResponse> {
    const documents = await this.prisma.document.findMany({
      where: {
        AND: [this.access.readableDocumentsWhere(personId), { spaceId }],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, title: true, updatedAt: true },
    });

    return {
      data: documents.map((document) => ({
        id: document.id,
        title: document.title,
        updatedAt: document.updatedAt.toISOString(),
        trashedAt: null,
      })),
    };
  }

  /** Documentos na lixeira da pessoa, dos movidos há menos tempo aos mais antigos. */
  async listTrash(personId: string): Promise<DocumentSummary[]> {
    const documents = await this.prisma.document.findMany({
      where: this.access.trashedDocumentsWhere(personId),
      orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        trashedAt: true,
      },
    });

    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updatedAt.toISOString(),
      trashedAt: document.trashedAt?.toISOString() ?? null,
    }));
  }

  /** Documento acessível à pessoa, com o nível de acesso dela. */
  async get(personId: string, documentId: string): Promise<Document> {
    const accessLevel = await this.access.resolveAccess(personId, documentId);

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    const document = await this.prisma.document.findFirst({
      where: {
        AND: [
          { id: documentId },
          {
            // O dono precisa abrir o que está na lixeira para restaurar ou
            // apagar; para todo o resto vale só a porta de leitura.
            OR: [
              this.access.readableDocumentsWhere(personId),
              this.access.trashedDocumentsWhere(personId),
            ],
          },
        ],
      },
      include: {
        favorites: { where: { personId }, select: { personId: true } },
      },
    });

    if (document === null) {
      throw documentNotFound();
    }

    return toDocument(document, accessLevel);
  }

  /**
   * Renomeia o documento. O acesso é conferido antes do corpo: um corpo
   * inválido não pode revelar que um documento alheio existe, nem que o
   * documento está na lixeira.
   */
  async rename(
    personId: string,
    documentId: string,
    body: unknown,
  ): Promise<Document> {
    const accessLevel = await this.access.resolveAccess(personId, documentId);

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    if (!canEdit(accessLevel)) {
      throw new ForbiddenException(CANNOT_EDIT_MESSAGE);
    }

    if (!(await this.access.canWrite(personId, documentId))) {
      throw new ConflictException(TRASHED_DOCUMENT_MESSAGE);
    }

    const data = parseBody(updateDocumentSchema, body);

    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: { title: data.title },
      include: {
        favorites: { where: { personId }, select: { personId: true } },
      },
    });

    return toDocument(document, accessLevel);
  }

  /**
   * Só o dono move, restaura e apaga. Qualquer outro nível — inclusive os de
   * compartilhamento que virão — sai daqui como 404, igual a documento
   * inexistente e a id malformado.
   */
  private async requireOwner(
    personId: string,
    documentId: string,
  ): Promise<void> {
    const accessLevel = await this.access.resolveAccess(personId, documentId);

    if (accessLevel !== 'owner') {
      throw documentNotFound();
    }
  }

  /** Avisa quem acompanha que o documento não aceita mais sessão aberta. */
  private notifyDocumentClosed(documentId: string): void {
    for (const listener of this.closedListeners) {
      listener(documentId);
    }
  }

  /**
   * Inscreve um ouvinte para os documentos que saíram do ar — movidos para a
   * lixeira ou apagados. Chamado no arranque, uma vez por ouvinte.
   */
  onDocumentClosed(listener: (documentId: string) => void): void {
    this.closedListeners.push(listener);
  }

  /**
   * Move o documento para a lixeira. Mover de novo não renova a data: a
   * gravação só alcança o que ainda está fora dela.
   */
  async trash(personId: string, documentId: string): Promise<Document> {
    await this.requireOwner(personId, documentId);

    await this.prisma.document.updateMany({
      where: { id: documentId, trashedAt: null },
      data: { trashedAt: new Date() },
    });

    this.notifyDocumentClosed(documentId);

    return this.get(personId, documentId);
  }

  /**
   * Tira o documento da lixeira. Conteúdo e favoritos nunca são tocados:
   * voltam exatamente como estavam.
   */
  async restore(personId: string, documentId: string): Promise<Document> {
    await this.requireOwner(personId, documentId);

    await this.prisma.document.updateMany({
      where: { id: documentId, trashedAt: { not: null } },
      data: { trashedAt: null },
    });

    return this.get(personId, documentId);
  }

  /**
   * Apaga o documento para sempre. Só o que já está na lixeira: nada some em
   * um passo só. O conteúdo e as linhas de `Favorite` vão junto, pelo
   * `onDelete: Cascade` do schema.
   */
  async delete(personId: string, documentId: string): Promise<void> {
    await this.requireOwner(personId, documentId);

    const { count } = await this.prisma.document.deleteMany({
      where: { id: documentId, trashedAt: { not: null } },
    });

    if (count === 0) {
      throw new ConflictException(DELETE_OUTSIDE_TRASH_MESSAGE);
    }

    this.notifyDocumentClosed(documentId);
  }

  /**
   * Estado Yjs guardado do documento, ou `null` se ainda não há nenhum. Não
   * recebe pessoa: quem autoriza é o módulo `collab`, antes de chamar.
   */
  async loadContent(documentId: string): Promise<Uint8Array | null> {
    const content = await this.prisma.documentContent.findUnique({
      where: { documentId },
      select: { state: true },
    });

    return content?.state ?? null;
  }

  /**
   * Grava o estado Yjs e avança o `updatedAt` do documento na mesma
   * transação, e só enquanto o documento está fora da lixeira. Não recebe
   * pessoa: quem autoriza é o módulo `collab`. Devolve se o conteúdo foi
   * mesmo guardado.
   */
  async saveContent(documentId: string, state: Uint8Array): Promise<boolean> {
    // O Prisma só aceita bytes respaldados por `ArrayBuffer`; o Yjs entrega
    // uma visão que o TypeScript tipa como `ArrayBufferLike`.
    const bytes = new Uint8Array(state);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // A mesma gravação decide e marca: nenhuma linha alcançada significa
        // documento na lixeira ou já apagado, e o conteúdo é descartado.
        const { count } = await tx.document.updateMany({
          where: { id: documentId, trashedAt: null },
          data: { updatedAt: new Date() },
        });

        if (count === 0) {
          this.logger.warn(
            `Conteúdo descartado: o documento ${documentId} não aceita mais gravação.`,
          );

          return false;
        }

        await tx.documentContent.upsert({
          where: { documentId },
          create: { documentId, state: bytes },
          update: { state: bytes },
        });

        return true;
      });
    } catch (error) {
      // O documento pode ter sido apagado enquanto a gravação esperava o
      // debounce: não há conteúdo a guardar e não é falha do processo.
      if (isMissingDocumentError(error)) {
        this.logger.warn(
          `Conteúdo descartado: o documento ${documentId} não existe mais.`,
        );

        return false;
      }

      throw error;
    }
  }
}
