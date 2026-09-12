import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";

export function useOwnedDocuments() {
  return useQuery({
    queryKey: ["documents", "owned"],
    queryFn: () => EXEMPLO_DOCUMENTOS.filter((document) => document.origin === "privado"),
  });
}
