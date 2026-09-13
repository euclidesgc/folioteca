import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSpace } from "../api/create-space";
import { chavesDeEspacos } from "../api/chaves";
import type { CreateSpaceDto } from "@/shared/api";

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSpaceDto) => createSpace(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chavesDeEspacos.all() });
    },
  });
}
