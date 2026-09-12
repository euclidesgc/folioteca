import { useOwnedDocuments } from "./use-owned-documents";

// decisão: `/inicio` mostra "atualizados recentemente", mas a única fonte de
// documentos nesta etapa é o espaço pessoal (M13) — é a mesma lista de
// `useOwnedDocuments`, já ordenada do mais recente ao mais antigo pelo
// servidor (`orderBy: { updatedAt: "desc" }`). Compartilhar a consulta evita
// duas buscas pelo mesmo dado quando a pessoa visita `/inicio` e
// `/documentos` na mesma sessão.
export function useRecentDocuments() {
  return useOwnedDocuments();
}
