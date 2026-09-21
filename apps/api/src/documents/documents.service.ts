import { ForbiddenException, Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import type { Document as DocumentRecord } from '@prisma/client';

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

/** Corpo público do documento: os campos do banco mais o nível de acesso. */
function toDocument(
  document: DocumentRecord,
  accessLevel: AccessLevel,
): Document {
  return {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    accessLevel,
  };
}

@Injectable()
export class DocumentsService {
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

    return toDocument(document, 'owner');
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
    });

    return toDocument(document, accessLevel);
  }
}
