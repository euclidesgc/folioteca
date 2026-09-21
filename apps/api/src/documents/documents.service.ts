import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma, type Document as DocumentRecord } from '@prisma/client';

import { canEdit } from '../access/access-level';
import { AccessService } from '../access/access.service';
import type { PersonWithOrganization } from '../auth/session.service';
import { parseBody } from '../common/parse-body';
import { PrismaService } from '../prisma/prisma.service';
import { documentNotFound } from './document-not-found';
import {
  DEFAULT_DOCUMENT_TITLE,
  listDocumentsQuerySchema,
  updateDocumentSchema,
} from './documents.schema';

type Document = components['schemas']['Document'];
type DocumentSummary = components['schemas']['DocumentSummary'];
type AccessLevel = components['schemas']['AccessLevel'];

const CANNOT_EDIT_MESSAGE =
  'Você não tem permissão para editar este documento.';

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
    accessLevel,
    isFavorite: favorites.length > 0,
  };
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Cria um documento sem título no espaço pessoal de quem chamou. O espaço
   * pessoal nasce junto, na mesma transação, se ainda não existir.
   */
  async create(person: PersonWithOrganization): Promise<Document> {
    const document = await this.prisma.$transaction(async (tx) => {
      const space = await tx.space.upsert({
        where: { personId: person.id },
        create: { type: 'PERSONAL', personId: person.id },
        update: {},
      });

      return tx.document.create({
        data: {
          title: DEFAULT_DOCUMENT_TITLE,
          spaceId: space.id,
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

    return documents.map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updatedAt.toISOString(),
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
        AND: [{ id: documentId }, this.access.readableDocumentsWhere(personId)],
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
   * inválido não pode revelar que um documento alheio existe.
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
   * transação. Não recebe pessoa: quem autoriza é o módulo `collab`.
   */
  async saveContent(documentId: string, state: Uint8Array): Promise<void> {
    // O Prisma só aceita bytes respaldados por `ArrayBuffer`; o Yjs entrega
    // uma visão que o TypeScript tipa como `ArrayBufferLike`.
    const bytes = new Uint8Array(state);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.documentContent.upsert({
          where: { documentId },
          create: { documentId, state: bytes },
          update: { state: bytes },
        });

        await tx.document.update({
          where: { id: documentId },
          data: { updatedAt: new Date() },
        });
      });
    } catch (error) {
      // O documento pode ter sido apagado enquanto a gravação esperava o
      // debounce: não há conteúdo a guardar e não é falha do processo.
      if (isMissingDocumentError(error)) {
        this.logger.warn(
          `Conteúdo descartado: o documento ${documentId} não existe mais.`,
        );

        return;
      }

      throw error;
    }
  }
}
