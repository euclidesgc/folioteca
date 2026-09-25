import type { NotFoundException } from '@nestjs/common';

import { DomainNotFoundException } from './domain-not-found.exception';

/**
 * 404 opaco de espaço: inexistente, com id malformado, que não é de unidade
 * ou fora do alcance de quem chama respondem exatamente a mesma coisa.
 */
export function spaceNotFound(): NotFoundException {
  return new DomainNotFoundException('Espaço não encontrado.');
}
