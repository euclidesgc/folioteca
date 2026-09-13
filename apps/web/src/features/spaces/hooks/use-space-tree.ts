import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/api";
import type { SpaceDto } from "@/shared/api";
import type { ExampleSpace } from "@/shared/example-data/folioteca";

// motivo: `GET /spaces` devolve a árvore já podada por visibilidade (Regra
// 6), aninhada em `children`; os consumidores atuais (`EspacosRoute`,
// `EspacoRoute`, `ArvoreDeEspacos`) ainda esperam a lista plana com
// `parentId` que os dados de exemplo do plano 01 usavam — achatar aqui
// mantém a assinatura do hook e adia a troca desses consumidores para a
// etapa 4.
function achatar(nodes: SpaceDto[], parentId: string | null): ExampleSpace[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      parentId,
      kind: node.kind === "UNIT" ? ("unit" as const) : ("free" as const),
      restricted: node.restricted,
    },
    ...achatar(node.children, node.id),
  ]);
}

export function useSpaceTree() {
  return useQuery({
    queryKey: ["spaces"],
    queryFn: async ({ signal }) => {
      const response = await httpClient.get<SpaceDto[]>("/spaces", { signal });
      return achatar(response.data, null);
    },
  });
}
