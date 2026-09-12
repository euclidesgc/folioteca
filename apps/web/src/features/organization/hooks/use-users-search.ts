import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../api/search-users";
import { chavesDeOrganizacao } from "../api/chaves";

export function useUsersSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: chavesDeOrganizacao.users(search),
    queryFn: ({ signal }) => searchUsers(search, signal),
    enabled,
  });
}
