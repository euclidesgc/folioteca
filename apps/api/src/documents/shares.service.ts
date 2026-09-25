import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { AccessService } from '../access/access.service';
import type { PersonWithOrganization } from '../auth/session.service';
import { isUuid } from '../common/is-uuid';
import { parseBody } from '../common/parse-body';
import { ptBrCollator } from '../common/pt-br-collator';
import { PrismaService } from '../prisma/prisma.service';
import { documentNotFound } from './document-not-found';
import { shareDocumentSchema } from './documents.schema';
import { TRASHED_DOCUMENT_MESSAGE } from './documents.service';

type DocumentShareResponse = components['schemas']['DocumentShareResponse'];
type DocumentAccessEntry = components['schemas']['DocumentAccessEntry'];
type DocumentAccessListResponse =
  components['schemas']['DocumentAccessListResponse'];

const OWNER_ONLY_MESSAGE =
  'Só o proprietário pode compartilhar este documento.';

const OWNER_ONLY_LIST_MESSAGE =
  'Só o proprietário pode ver quem tem acesso a este documento.';

const OWNER_ONLY_REMOVE_MESSAGE =
  'Só o proprietário pode remover o acesso a este documento.';

const SHARE_WITH_SELF_MESSAGE = 'Você já é o proprietário deste documento.';

const PERSON_NOT_FOUND_MESSAGE = 'Pessoa não encontrada nesta instância.';

/** Compartilhamento direto de documento com uma pessoa da instância. */
@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  /**
   * Who wants to know that a person's share of a document changed. The
   * `collab` module subscribes here; this service does not know it (the import
   * would be circular).
   */
  private readonly changedListeners: ((
    documentId: string,
    personId: string,
  ) => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /**
   * Gives the person the requested access level ("view" or "edit") to the
   * document. Access is checked before the body, so an invalid body does not
   * reveal that someone else's document exists. Sharing again with the same
   * person keeps a single row and switches its level in either direction.
   */
  async share(
    requester: PersonWithOrganization,
    documentId: string,
    personId: string,
    body: unknown,
  ): Promise<DocumentShareResponse> {
    const accessLevel = await this.access.resolveAccess(
      requester.id,
      documentId,
    );

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    if (accessLevel !== 'owner') {
      throw new ForbiddenException(OWNER_ONLY_MESSAGE);
    }

    if (!(await this.access.canWrite(requester.id, documentId))) {
      throw new ConflictException(TRASHED_DOCUMENT_MESSAGE);
    }

    const { level } = parseBody(shareDocumentSchema, body);
    const storedLevel = level === 'edit' ? 'EDIT' : 'VIEW';

    if (personId === requester.id) {
      throw new BadRequestException(SHARE_WITH_SELF_MESSAGE);
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

    await this.prisma.documentShare.upsert({
      where: { documentId_personId: { documentId, personId } },
      create: { documentId, personId, level: storedLevel },
      update: { level: storedLevel },
    });

    this.notifyShareChanged(documentId, personId);

    return {
      data: {
        personId: person.id,
        name: person.name,
        email: person.email,
        level,
      },
    };
  }

  /**
   * Removes the person's direct share of the document. Idempotent: removing a
   * share that does not exist (already removed, never created, the owner
   * themself or a malformed personId) succeeds without changes. Checks run in
   * the order not found (opaque) → forbidden (not the owner) → conflict
   * (document in the trash).
   */
  async remove(
    requester: PersonWithOrganization,
    documentId: string,
    personId: string,
  ): Promise<void> {
    const accessLevel = await this.access.resolveAccess(
      requester.id,
      documentId,
    );

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    if (accessLevel !== 'owner') {
      throw new ForbiddenException(OWNER_ONLY_REMOVE_MESSAGE);
    }

    if (!(await this.access.canWrite(requester.id, documentId))) {
      throw new ConflictException(TRASHED_DOCUMENT_MESSAGE);
    }

    if (!isUuid(personId)) {
      return;
    }

    const { count } = await this.prisma.documentShare.deleteMany({
      where: { documentId, personId },
    });

    if (count > 0) {
      this.notifyShareChanged(documentId, personId);
    }
  }

  /**
   * Subscribes a listener to share changes (level switched or share removed).
   * Called at startup, once per listener.
   */
  onShareChanged(
    listener: (documentId: string, personId: string) => void,
  ): void {
    this.changedListeners.push(listener);
  }

  /**
   * Calls every listener. A throwing listener does not break the HTTP
   * response: the error is logged without the ids of who was involved.
   */
  private notifyShareChanged(documentId: string, personId: string): void {
    for (const listener of this.changedListeners) {
      try {
        listener(documentId, personId);
      } catch (error) {
        this.logger.error(
          'A share change listener failed.',
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  /**
   * Lista quem tem acesso ao documento: o proprietário primeiro, depois as
   * pessoas em ordem pt-BR (nome, e-mail, id). Só o proprietário consulta; a
   * lixeira não bloqueia a leitura. O acesso é conferido antes de ler as
   * linhas de compartilhamento.
   */
  async list(
    requester: PersonWithOrganization,
    documentId: string,
  ): Promise<DocumentAccessListResponse> {
    const accessLevel = await this.access.resolveAccess(
      requester.id,
      documentId,
    );

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    if (accessLevel !== 'owner') {
      throw new ForbiddenException(OWNER_ONLY_LIST_MESSAGE);
    }

    const shares = await this.prisma.documentShare.findMany({
      where: { documentId },
      select: {
        level: true,
        person: { select: { id: true, name: true, email: true } },
      },
    });

    const shareEntries: DocumentAccessEntry[] = shares
      .map(({ level, person }) => ({
        personId: person.id,
        name: person.name,
        email: person.email,
        level: level === 'EDIT' ? ('edit' as const) : ('view' as const),
        isCurrentPerson: false,
      }))
      .sort(
        (a, b) =>
          ptBrCollator.compare(a.name, b.name) ||
          ptBrCollator.compare(a.email, b.email) ||
          ptBrCollator.compare(a.personId, b.personId),
      );

    const ownerEntry: DocumentAccessEntry = {
      personId: requester.id,
      name: requester.name,
      email: requester.email,
      level: 'owner',
      isCurrentPerson: true,
    };

    return { data: [ownerEntry, ...shareEntries] };
  }
}
