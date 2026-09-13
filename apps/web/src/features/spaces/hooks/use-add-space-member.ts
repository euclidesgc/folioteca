import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSpaceMember } from "../api/add-space-member";
import { chavesDeEspacos } from "../api/chaves";

export function useAddSpaceMember(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addSpaceMember(spaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
