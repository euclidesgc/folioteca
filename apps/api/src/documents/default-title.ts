/** Prefixo do nome com que um documento novo nasce: "documento-sem-titulo-N". */
export const DEFAULT_TITLE_PREFIX = 'documento-sem-titulo-';

/**
 * Só ocupa número o título exatamente no padrão, com N inteiro positivo sem
 * zero à esquerda: "documento-sem-titulo-01", "-0" e títulos com sufixo não
 * contam.
 */
const DEFAULT_TITLE_PATTERN = /^documento-sem-titulo-([1-9]\d*)$/;

/**
 * Nome do próximo documento novo: o prefixo seguido do menor inteiro a partir
 * de 1 que nenhum dos títulos informados ocupa.
 */
export function nextDefaultTitle(titles: string[]): string {
  const taken = new Set<number>();

  for (const title of titles) {
    const match = DEFAULT_TITLE_PATTERN.exec(title);
    if (match?.[1] !== undefined) {
      taken.add(Number(match[1]));
    }
  }

  let next = 1;
  while (taken.has(next)) {
    next += 1;
  }

  return `${DEFAULT_TITLE_PREFIX}${next}`;
}
