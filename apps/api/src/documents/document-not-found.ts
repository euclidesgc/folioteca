import { DomainNotFoundException } from '../common/domain-not-found.exception';

/**
 * Única origem de 404 do módulo de documentos: documento inexistente, de
 * outra pessoa ou com id malformado respondem exatamente a mesma coisa.
 */
export function documentNotFound(): DomainNotFoundException {
  return new DomainNotFoundException('Documento não encontrado.');
}
