import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeSpaceMember } from "../api/remove-space-member";
import { chavesDeEspacos } from "../api/chaves";

export function useRemoveSpaceMember(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeSpaceMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
