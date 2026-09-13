import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSpaceInheritance } from "../api/update-space-inheritance";
import { chavesDeEspacos } from "../api/chaves";

export function useUpdateSpaceInheritance(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inheritsFromParent: boolean) =>
      updateSpaceInheritance(spaceId, { inheritsFromParent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
