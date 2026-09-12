import { useQuery } from "@tanstack/react-query";
import type { DocumentSummaryDto } from "@/shared/api";
import { chavesDeDocumentos } from "../api/chaves";

// decisão: espaço organizacional é o plano 05 — documento só existe no
// espaço pessoal nesta etapa (M13), então nenhum espaço tem documento ainda.
export function useDocumentsBySpace(spaceId: string) {
  return useQuery({
    queryKey: chavesDeDocumentos.bySpace(spaceId),
    queryFn: (): Promise<DocumentSummaryDto[]> => Promise.resolve([]),
  });
}
