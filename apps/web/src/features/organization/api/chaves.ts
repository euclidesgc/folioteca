// por quê: a chave é citada tanto pela consulta quanto pela invalidação que
// roda depois de cada mutação da árvore (criar, renomear, apagar, lotar,
// desalojar, promover/rebaixar) — escrita duas vezes, bastaria uma divergir
// para a árvore continuar mostrando o que o servidor já mudou.
export const chavesDeOrganizacao = {
  me: () => ["me"] as const,
  units: () => ["units"] as const,
  unitTypes: () => ["unit-types"] as const,
  users: (search: string) => ["users", search] as const,
};
