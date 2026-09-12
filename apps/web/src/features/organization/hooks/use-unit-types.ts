import { useQuery } from "@tanstack/react-query";
import { listUnitTypes } from "../api/get-unit-types";
import { chavesDeOrganizacao } from "../api/chaves";

export function useUnitTypes(enabled = true) {
  return useQuery({
    queryKey: chavesDeOrganizacao.unitTypes(),
    queryFn: ({ signal }) => listUnitTypes(signal),
    enabled,
  });
}
