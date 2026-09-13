import { useQuery } from "@tanstack/react-query";
import { chavesDeEspacos } from "../api/chaves";
import { getSpaceMembers } from "../api/get-space-members";

export function useSpaceMembers(spaceId: string, enabled = true) {
  return useQuery({
    queryKey: chavesDeEspacos.members(spaceId),
    queryFn: ({ signal }) => getSpaceMembers(spaceId, signal),
    enabled,
  });
}
