import { useQuery } from "@tanstack/react-query";
import { getInvitationByToken } from "../api/convite-publico-api";
import { chavesDeConvites } from "../api/chaves";

export function useConvitePublico(token: string) {
  return useQuery({
    queryKey: chavesDeConvites.porToken(token),
    queryFn: ({ signal }) => getInvitationByToken(token, signal),
    // motivo: a regra 8 do plano faz `by-token` devolver sempre o mesmo 404
    // `INVITATION_INVALID` para token errado, vencido, usado ou revogado — não
    // é um erro transitório de rede, e o padrão de 3 tentativas só atrasaria
    // em segundos a tela "Convite inválido" que o resultado já decidiu.
    retry: false,
  });
}
