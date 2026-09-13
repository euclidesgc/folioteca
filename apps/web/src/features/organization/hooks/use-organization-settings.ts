import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chavesDeOrganizacao } from "../api/chaves";
import { getOrganizationSettings } from "../api/get-organization-settings";
import { updateOrganizationSettings } from "../api/update-organization-settings";

export function useOrganizationSettings() {
  return useQuery({
    queryKey: chavesDeOrganizacao.settings(),
    queryFn: ({ signal }) => getOrganizationSettings(signal),
  });
}

export function useUpdateOrganizationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (spacesInheritByDefault: boolean) =>
      updateOrganizationSettings({ spacesInheritByDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chavesDeOrganizacao.settings(),
      });
    },
  });
}
