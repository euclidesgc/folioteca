import { useQuery } from "@tanstack/react-query";
import { getOrganization } from "../api/get-organization";

export function useOrganizacaoStatus() {
  return useQuery({
    queryKey: ["organization-status"],
    queryFn: ({ signal }) => getOrganization(signal),
  });
}
