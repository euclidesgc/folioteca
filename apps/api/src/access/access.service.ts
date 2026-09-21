import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { AccessLevel } from './access-level';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Decisão de acesso a documento, em duas portas: uma para um documento
 * (`resolveAccess`) e outra para listas (`readableDocumentsWhere`). As duas
 * respondem sempre a mesma coisa; compartilhamento e árvore de unidades vão
 * mudar o corpo delas, não quem as chama.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nível de acesso da pessoa ao documento. Documento inexistente, de outra
   * pessoa ou com id malformado devolvem `'none'`, indistinguíveis entre si.
   * Ser administradora não dá acesso a documento alheio.
   */
  async resolveAccess(
    personId: string,
    documentId: string,
  ): Promise<AccessLevel> {
    if (!UUID_PATTERN.test(documentId)) {
      return 'none';
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId },
      select: { ownerId: true },
    });

    if (document?.ownerId !== personId) {
      return 'none';
    }

    return 'owner';
  }

  /** Filtro dos documentos que a pessoa pode ler. Única fonte para listas. */
  readableDocumentsWhere(personId: string): Prisma.DocumentWhereInput {
    return { ownerId: personId };
  }
}
