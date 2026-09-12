import { useQuery } from "@tanstack/react-query";
import { getUnitsTree } from "../api/get-units-tree";
import { chavesDeOrganizacao } from "../api/chaves";

export function useUnitsTree() {
  return useQuery({
    queryKey: chavesDeOrganizacao.units(),
    queryFn: ({ signal }) => getUnitsTree(signal),
  });
}
