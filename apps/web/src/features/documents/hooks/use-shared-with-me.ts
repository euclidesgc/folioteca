import { useQuery } from "@tanstack/react-query";
import type { DocumentSummaryDto } from "@/shared/api";
import { chavesDeDocumentos } from "../api/chaves";

// decisão: compartilhamento é o plano 06 — sem rota de API para isto ainda,
// a lista fica vazia em vez de apontar para um documento que não existe.
export function useSharedWithMe() {
  return useQuery({
    queryKey: chavesDeDocumentos.sharedWithMe(),
    queryFn: (): Promise<DocumentSummaryDto[]> => Promise.resolve([]),
  });
}
