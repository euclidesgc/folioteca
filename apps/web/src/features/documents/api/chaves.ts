// por quê: a chave de cada filtro é citada tanto pela consulta que lista
// quanto pela invalidação que roda depois de criar, favoritar, mover para a
// lixeira, restaurar ou apagar um documento — escrita duas vezes, bastaria
// uma divergir para a lista continuar mostrando o que o servidor já mudou.
export const chavesDeDocumentos = {
  owned: () => ["documents", "owned"] as const,
  favorites: () => ["documents", "favorites"] as const,
  trash: () => ["documents", "trash"] as const,
  sharedWithMe: () => ["documents", "shared-with-me"] as const,
  bySpace: (spaceId: string) => ["documents", "space", spaceId] as const,
  detail: (id: string) => ["documents", id] as const,
};
