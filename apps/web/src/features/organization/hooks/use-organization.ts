import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/get-me";
import { chavesDeOrganizacao } from "../api/chaves";

// decisão: a mesma chave de `useMe()` — o nome da organização é o nome da
// unidade raiz, que `GET /me` já traz junto com papel e lotações; uma segunda
// chave duplicaria a mesma requisição sem motivo.
export function useOrganization() {
  return useQuery({
    queryKey: chavesDeOrganizacao.me(),
    queryFn: ({ signal }) => getMe(signal),
    select: (me) => ({ name: me.organization.name }),
  });
}
