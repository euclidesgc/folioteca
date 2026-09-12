export type ExampleSpaceKind = "unit" | "free";

export type ExampleSpace = {
  id: string;
  name: string;
  parentId: string | null;
  kind: ExampleSpaceKind;
  restricted: boolean;
};

export const EXEMPLO_ESPACOS: ExampleSpace[] = [
  { id: "produto", name: "Produto", parentId: null, kind: "unit", restricted: false },
  { id: "design", name: "Design", parentId: "produto", kind: "unit", restricted: false },
  { id: "engenharia", name: "Engenharia", parentId: "produto", kind: "unit", restricted: false },
  { id: "backend", name: "Backend", parentId: "engenharia", kind: "unit", restricted: false },
  { id: "frontend", name: "Frontend", parentId: "engenharia", kind: "unit", restricted: false },
  { id: "operacoes", name: "Operações", parentId: null, kind: "unit", restricted: false },
  { id: "financeiro", name: "Financeiro", parentId: "operacoes", kind: "unit", restricted: false },
  { id: "pessoas", name: "Pessoas", parentId: "operacoes", kind: "unit", restricted: false },
  {
    id: "comite-seguranca",
    name: "Comitê de Segurança",
    parentId: null,
    kind: "free",
    restricted: true,
  },
];
