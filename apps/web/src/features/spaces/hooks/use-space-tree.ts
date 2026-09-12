import { useQuery } from "@tanstack/react-query";
import { EXEMPLO_ESPACOS } from "@/shared/example-data/folioteca";

export function useSpaceTree() {
  return useQuery({
    queryKey: ["spaces"],
    queryFn: () => EXEMPLO_ESPACOS,
  });
}
