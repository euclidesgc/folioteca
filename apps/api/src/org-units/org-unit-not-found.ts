import { DomainNotFoundException } from '../common/domain-not-found.exception';

/**
 * Única origem de 404 do módulo de unidades: unidade inexistente, de outra
 * organização ou com id malformado respondem exatamente a mesma coisa.
 */
export function orgUnitNotFound(): DomainNotFoundException {
  return new DomainNotFoundException('Unidade não encontrada.');
}
