import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_DOCUMENTOS } from "@/shared/example-data/folioteca";

export function useSharedWithMe() {
  return useQuery({
    queryKey: ["documents", "shared-with-me"],
    queryFn: () => EXEMPLO_DOCUMENTOS.filter((document) => document.origin === "pessoa"),
  });
}
