// motivo: a mesma regra de normalização do backfill escrito à mão na
// migration (`lower(btrim(name))`) — nome e tipo de unidade comparam por
// aqui, nunca pelo valor exibido, ou "Produto" e " produto " colidiriam sem
// nenhuma mensagem explicando por quê.
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
