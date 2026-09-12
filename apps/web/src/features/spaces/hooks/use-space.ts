import { useQuery } from "@tanstack/react-query";
import { ApiError, httpClient } from "@/shared/api";
import type { SpaceDetailDto } from "@/shared/api";
import type { ExampleSpace } from "@/shared/example-data/folioteca";

export function useSpace(id: string) {
  return useQuery({
    queryKey: ["spaces", id],
    queryFn: async ({ signal }) => {
      try {
        const response = await httpClient.get<SpaceDetailDto>(`/spaces/${id}`, { signal });
        const espaco = response.data;
        const exemplo: ExampleSpace = {
          id: espaco.id,
          name: espaco.name,
          parentId: espaco.parentId,
          kind: espaco.kind === "UNIT" ? "unit" : "free",
          restricted: espaco.restricted,
        };
        return exemplo;
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
