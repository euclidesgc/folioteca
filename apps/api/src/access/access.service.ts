import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { canEdit, type AccessLevel } from './access-level';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** O que uma decisão de acesso precisa saber sobre o documento. */
type DocumentDecision = {
  ownerId: string;
  trashedAt: Date | null;
  shareLevel: 'view' | 'edit' | null;
};

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

  return document.shareLevel ?? 'none';
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
   * Lê uma vez só o que decide o acesso ao documento, com o compartilhamento
   * direto da pessoa na mesma consulta. Id malformado não chega ao banco e não
   * tem decisão alguma.
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
      },
    });

    if (document === null) {
      return null;
    }

    const share = document.shares[0];

    return {
      ownerId: document.ownerId,
      trashedAt: document.trashedAt,
      shareLevel:
        share === undefined ? null : share.level === 'EDIT' ? 'edit' : 'view',
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
  readableDocumentsWhere(personId: string): Prisma.DocumentWhereInput {
    return {
      trashedAt: null,
      OR: [{ ownerId: personId }, { shares: { some: { personId } } }],
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
