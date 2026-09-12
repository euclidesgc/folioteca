import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";

export function useRecentDocuments() {
  return useQuery({
    queryKey: ["documents", "recent"],
    queryFn: () =>
      [...EXEMPLO_DOCUMENTOS].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
  });
}
