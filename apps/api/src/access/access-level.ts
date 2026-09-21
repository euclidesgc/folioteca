/**
 * Nível de acesso de uma pessoa a um documento. `'none'` é a ausência de
 * acesso: quem recebe esse nível não pode nem saber que o documento existe.
 */
export type AccessLevel = 'owner' | 'edit' | 'view' | 'none';

/** Diz se o nível permite gravar no documento. */
export function canEdit(level: AccessLevel): boolean {
  return level === 'owner' || level === 'edit';
}
