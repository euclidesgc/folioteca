import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/get-me";
import { chavesDeOrganizacao } from "../api/chaves";

export function useMe() {
  return useQuery({
    queryKey: chavesDeOrganizacao.me(),
    queryFn: ({ signal }) => getMe(signal),
  });
}
