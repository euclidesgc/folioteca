import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "../api/list-documents";
import { chavesDeDocumentos } from "../api/chaves";

export function useTrashedDocuments() {
  return useQuery({
    queryKey: chavesDeDocumentos.trash(),
    queryFn: ({ signal }) => listDocuments("TRASH", signal),
  });
}
