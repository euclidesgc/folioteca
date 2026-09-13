import { useQuery } from "@tanstack/react-query";
import { ApiError, httpClient } from "@/shared/api";
import type { SpaceDetailDto } from "@/shared/api";
import { chavesDeEspacos } from "../api/chaves";

export function useSpace(id: string) {
  return useQuery({
    queryKey: chavesDeEspacos.detail(id),
    queryFn: async ({ signal }) => {
      try {
        const response = await httpClient.get<SpaceDetailDto>(`/spaces/${id}`, { signal });
        return response.data;
      } catch (error) {
        // decisão: TanStack Query trata `undefined` como "ainda não
        // buscou", não como "buscou e não achou" — `null` é o valor de
        // sucesso correto para um 404 `SPACE_NOT_FOUND`.
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
  });
}
