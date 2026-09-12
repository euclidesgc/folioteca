import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";

export function useDocument(id: string) {
  return useQuery({
    queryKey: ["documents", id],
    // decisão: TanStack Query trata `undefined` como "ainda não buscou", não
    // como "buscou e não achou" — `null` é o valor de sucesso correto aqui.
    queryFn: () => EXEMPLO_DOCUMENTOS.find((document) => document.id === id) ?? null,
  });
}
