import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "../api/list-documents";
import { chavesDeDocumentos } from "../api/chaves";

export function useFavoriteDocuments() {
  return useQuery({
    queryKey: chavesDeDocumentos.favorites(),
    queryFn: ({ signal }) => listDocuments("FAVORITES", signal),
  });
}
