import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_ORGANIZACAO } from "@/shared/example-data/folioteca";

export function useOrganization() {
  return useQuery({
    queryKey: ["organization"],
    queryFn: () => EXEMPLO_ORGANIZACAO,
  });
}
