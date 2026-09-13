import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSpace } from "../api/delete-space";
import { chavesDeEspacos } from "../api/chaves";

export function useDeleteSpace(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteSpace(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
