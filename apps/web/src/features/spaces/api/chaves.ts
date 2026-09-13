// por quê: a chave é citada pelas consultas e pela invalidação que roda
// depois de cada mutação de espaço (criar, renomear, restringir, herança,
// membros, apagar) — escrita duas vezes, bastaria uma divergir para a árvore
// continuar mostrando o que o servidor já mudou. `all()` é prefixo de todas
// as outras: invalidar por ela refresca árvore, detalhe e membros de uma vez.
export const chavesDeEspacos = {
  all: () => ["spaces"] as const,
  detail: (id: string) => ["spaces", id] as const,
  members: (id: string) => ["spaces", id, "members"] as const,
};
