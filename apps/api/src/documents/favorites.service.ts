import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';
import { Prisma } from '@prisma/client';

import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { documentNotFound } from './document-not-found';

type DocumentSummary = components['schemas']['DocumentSummary'];

/** Chave única violada: dois `PUT` em corrida gravaram a mesma linha. */
const UNIQUE_VIOLATION = 'P2002';

/** Chave estrangeira violada: o documento sumiu entre o acesso e a gravação. */
const FOREIGN_KEY_VIOLATION = 'P2003';

function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : null;
}

/**
 * Favoritos: único arquivo de produção que toca a tabela `Favorite`. Favorito
 * é marcação pessoal e não dá acesso a documento algum — toda operação começa
 * pelas portas de acesso e a listagem passa por `readableDocumentsWhere`.
 */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Marca o documento como favorito. Repetir não renova o `createdAt`. */
  async add(personId: string, documentId: string): Promise<void> {
    const accessLevel = await this.access.resolveAccess(personId, documentId);

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    try {
      await this.prisma.favorite.upsert({
        where: { personId_documentId: { personId, documentId } },
        create: { personId, documentId },
        update: {},
      });
    } catch (error) {
      const code = prismaErrorCode(error);

      // Dois `PUT` em corrida: a linha já existe, que é o resultado pedido.
      if (code === UNIQUE_VIOLATION) {
        return;
      }

      // O documento foi apagado depois da decisão de acesso.
      if (code === FOREIGN_KEY_VIOLATION) {
        throw documentNotFound();
      }

      throw error;
    }
  }

  /** Desmarca o documento. Ninguém desfavorita o que não enxerga. */
  async remove(personId: string, documentId: string): Promise<void> {
    const accessLevel = await this.access.resolveAccess(personId, documentId);

    if (accessLevel === 'none') {
      throw documentNotFound();
    }

    await this.prisma.favorite.deleteMany({ where: { personId, documentId } });
  }

  /**
   * Favoritos da pessoa, do mais recente para o mais antigo. O título é lido
   * na hora: nada é copiado para `Favorite`. Favorito de documento que a
   * pessoa deixou de enxergar não é apagado nem avisado — só não aparece, e
   * volta a aparecer se o acesso voltar.
   */
  async list(personId: string): Promise<DocumentSummary[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        personId,
        document: this.access.readableDocumentsWhere(personId),
      },
      orderBy: [{ createdAt: 'desc' }, { documentId: 'desc' }],
      take: 100,
      select: {
        document: { select: { id: true, title: true, updatedAt: true } },
      },
    });

    // A porta de leitura já deixa a lixeira de fora: nenhum favorito listado
    // está nela, e a coluna nem precisa ser selecionada.
    return favorites.map(({ document }) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updatedAt.toISOString(),
      trashedAt: null,
    }));
  }
}
