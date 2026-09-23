import { Injectable } from '@nestjs/common';
import type { components } from '@folioteca/api-contract';

import { PrismaService } from '../prisma/prisma.service';

type PeopleResponse = components['schemas']['PeopleResponse'];

/**
 * Teto duro de resultados, constante do servidor. Não há parâmetro de limite
 * na rota de propósito: ele seria um botão para pedir a instância inteira.
 */
export const PEOPLE_SEARCH_LIMIT = 10;

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca pessoas da organização por parte do nome ou do e-mail. Termo em
   * branco devolve lista vazia sem tocar o banco: o campo nasce vazio e volta
   * a ficar vazio, e um 400 transformaria o estado normal da tela em erro.
   *
   * O `orderBy` vai ao banco aqui, ao contrário da lista de lotados: ele é só
   * o critério de **quais** dez o `take` recorta, e a tela ordena o que
   * recebeu. `hasMore` nasce de ler um a mais e devolver o limite.
   */
  async search(organizationId: string, q?: string): Promise<PeopleResponse> {
    const term = q?.trim() ?? '';

    if (term.length === 0) {
      return { data: [], hasMore: false };
    }

    const found = await this.prisma.person.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: PEOPLE_SEARCH_LIMIT + 1,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });

    return {
      data: found.slice(0, PEOPLE_SEARCH_LIMIT),
      hasMore: found.length > PEOPLE_SEARCH_LIMIT,
    };
  }
}
