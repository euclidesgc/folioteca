import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { getDocument } from "../api/get-document";
import { chavesDeDocumentos } from "../api/chaves";

export function useDocument(id: string) {
  return useQuery({
    queryKey: chavesDeDocumentos.detail(id),
    queryFn: async ({ signal }) => {
      try {
        return await getDocument(id, signal);
      } catch (erro) {
        // decisão: TanStack Query trata `undefined` como "ainda não buscou",
        // não como "buscou e não achou" — `null` é o valor de sucesso
        // correto para o 404 `DOCUMENT_NOT_FOUND` (documento inexistente ou
        // de outra pessoa; a regra 2 do plano não distingue os dois casos).
        if (erro instanceof ApiError && erro.status === 404) {
          return null;
        }
        throw erro;
      }
    },
  });
}
