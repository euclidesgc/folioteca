import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSpace } from "../api/update-space";
import { chavesDeEspacos } from "../api/chaves";
import type { UpdateSpaceDto } from "@/shared/api";

export function useUpdateSpace(spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSpaceDto) => updateSpace(spaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
