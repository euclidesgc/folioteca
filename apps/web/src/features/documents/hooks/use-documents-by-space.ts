import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";

export function useDocumentsBySpace(spaceId: string) {
  return useQuery({
    queryKey: ["documents", "space", spaceId],
    queryFn: () =>
      EXEMPLO_DOCUMENTOS.filter((document) => document.spaceId === spaceId),
  });
}
