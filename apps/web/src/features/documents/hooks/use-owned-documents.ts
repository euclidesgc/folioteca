import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "../api/list-documents";
import { chavesDeDocumentos } from "../api/chaves";

export function useOwnedDocuments() {
  return useQuery({
    queryKey: chavesDeDocumentos.owned(),
    queryFn: ({ signal }) => listDocuments("OWNED", signal),
  });
}
