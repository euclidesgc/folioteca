import { useQuery } from "@tanstack/react-query";
import { listInvitations } from "../api/convites-api";
import { chavesDeConvites } from "../api/chaves";

export function useConvites() {
  return useQuery({
    queryKey: chavesDeConvites.pendentes(),
    queryFn: ({ signal }) => listInvitations(signal),
  });
}
