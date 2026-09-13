import { useQuery } from "@tanstack/react-query";
import { httpClient } from "@/shared/api";
import type { SpaceDto } from "@/shared/api";
import { chavesDeEspacos } from "../api/chaves";

export type EspacoResumido = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "unit" | "free";
  restricted: boolean;
  unitId: string | null;
  managerId: string | null;
  inheritsFromParent: boolean;
};

// motivo: `GET /spaces` devolve a árvore já podada por visibilidade (Regra
// 6), aninhada em `children`; a barra lateral e as rotas trabalham com a
// lista plana — achatar aqui mantém um só ponto que conhece as duas formas.
function achatar(nodes: SpaceDto[], parentId: string | null): EspacoResumido[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      parentId,
      kind: node.kind === "UNIT" ? ("unit" as const) : ("free" as const),
      restricted: node.restricted,
      unitId: node.unitId,
      managerId: node.managerId,
      inheritsFromParent: node.inheritsFromParent,
    },
    ...achatar(node.children, node.id),
  ]);
}

export function useSpaceTree() {
  return useQuery({
    queryKey: chavesDeEspacos.all(),
    queryFn: async ({ signal }) => {
      const response = await httpClient.get<SpaceDto[]>("/spaces", { signal });
      return achatar(response.data, null);
    },
  });
}
