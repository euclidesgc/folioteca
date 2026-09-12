import { useQuery } from "@tanstack/react-query";
import { findSpace } from "../model/tree";

export function useSpace(id: string) {
  return useQuery({
    queryKey: ["spaces", id],
    // decisão: TanStack Query trata `undefined` como "ainda não buscou", não
    // como "buscou e não achou" — `null` é o valor de sucesso correto aqui.
    queryFn: () => findSpace(id) ?? null,
  });
}
