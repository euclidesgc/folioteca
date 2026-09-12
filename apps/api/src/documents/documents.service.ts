import { Injectable } from "@nestjs/common";
import { DocumentNotFoundError } from "../common/errors/domain-error";
import type { DocumentFilter } from "./dto/list-documents.query.dto";
import {
  DocumentsRepository,
  type DocumentRecord,
  type DocumentSummaryRecord,
} from "./documents.repository";

export type DocumentDetail = DocumentRecord & { favorited: boolean };
export type DocumentTrashState = { id: string; deletedAt: Date | null };
export type DocumentFavoriteState = { id: string; favorited: boolean };

@Injectable()
export class DocumentsService {
  constructor(private readonly repository: DocumentsRepository) {}

  create(userId: string): Promise<DocumentRecord> {
    return this.repository.create(userId);
  }

  list(userId: string, filter: DocumentFilter): Promise<DocumentSummaryRecord[]> {
    return this.repository.listForUser(userId, filter);
  }

  async getById(userId: string, id: string): Promise<DocumentDetail> {
    const document = await this.repository.findByIdForOwner(id, userId);
    if (!document) {
      throw new DocumentNotFoundError();
    }
    const favorited = await this.repository.isFavoritedBy(id, userId);
    return { ...document, favorited };
  }

  async updateTitle(userId: string, id: string, title: string): Promise<DocumentDetail> {
    const updated = await this.repository.updateTitle(id, userId, title);
    if (!updated) {
      throw new DocumentNotFoundError();
    }
    const favorited = await this.repository.isFavoritedBy(id, userId);
    return { ...updated, favorited };
  }

  async moveToTrash(userId: string, id: string): Promise<DocumentTrashState> {
    const trashed = await this.repository.moveToTrash(id, userId);
    if (!trashed) {
      throw new DocumentNotFoundError();
    }
    return { id: trashed.id, deletedAt: trashed.deletedAt };
  }

  async restore(userId: string, id: string): Promise<DocumentTrashState> {
    const restored = await this.repository.restore(id, userId);
    if (!restored) {
      throw new DocumentNotFoundError();
    }
    return { id: restored.id, deletedAt: restored.deletedAt };
  }

  async deletePermanently(userId: string, id: string): Promise<void> {
    const deleted = await this.repository.deletePermanently(id, userId);
    if (!deleted) {
      throw new DocumentNotFoundError();
    }
  }

  async favorite(userId: string, id: string): Promise<DocumentFavoriteState> {
    const document = await this.repository.findByIdForOwner(id, userId);
    if (!document) {
      throw new DocumentNotFoundError();
    }
    await this.repository.addFavorite(id, userId);
    return { id, favorited: true };
  }

  async unfavorite(userId: string, id: string): Promise<DocumentFavoriteState> {
    const document = await this.repository.findByIdForOwner(id, userId);
    if (!document) {
      throw new DocumentNotFoundError();
    }
    await this.repository.removeFavorite(id, userId);
    return { id, favorited: false };
  }

  // motivo: a regra 2 ("mesmo 404 de um id inexistente") é a que o
  // `onAuthenticate` da colaboração (etapa 4) reaplica no handshake —
  // sem o resto da forma de leitura (favorited, content) que `getById`
  // monta para a rota HTTP.
  async assertAccess(userId: string, id: string): Promise<void> {
    const document = await this.repository.findByIdForOwner(id, userId);
    if (!document) {
      throw new DocumentNotFoundError();
    }
  }

  getState(id: string): Promise<Uint8Array | null> {
    return this.repository.getState(id);
  }

  saveDerivedState(
    id: string,
    state: Uint8Array,
    content: unknown[],
    plainText: string,
  ): Promise<void> {
    return this.repository.saveDerivedState(id, state, content, plainText);
  }
}
