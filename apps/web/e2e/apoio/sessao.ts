import { test as base, type Page } from "@playwright/test";

const CAMINHO_DA_SESSAO = "**/api/auth/get-session*";

const PESSOA_DE_TESTE = {
  id: "pessoa-de-teste",
  name: "Pessoa de Teste",
  email: "pessoa@exemplo.com",
  emailVerified: true,
  image: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SESSAO_DE_TESTE = {
  session: {
    id: "sessao-de-teste",
    token: "token-de-teste",
    userId: PESSOA_DE_TESTE.id,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  user: PESSOA_DE_TESTE,
};

// motivo: o assunto destes casos é o esqueleto e a acessibilidade, não a
// estrutura organizacional — `ADMIN` é o que deixa o bloco "Instância"
// (com `HealthStatus`, que `health.spec.ts` mede) renderizar, e uma unidade
// raiz sem filha nem gente lotada é o suficiente para `ArvoreDeUnidades` sair
// do estado de carregamento sem cair no de erro.
const ME_DE_TESTE = {
  id: PESSOA_DE_TESTE.id,
  name: PESSOA_DE_TESTE.name,
  email: PESSOA_DE_TESTE.email,
  role: "ADMIN",
  organization: { id: "organizacao-de-teste", name: "Organização de Teste" },
  units: [{ id: "unidade-raiz-de-teste", name: "Organização de Teste", path: ["Organização de Teste"] }],
};

const ORGANIZACAO_DE_TESTE = { status: "READY", name: "Organização de Teste" };

const UNIDADES_DE_TESTE = {
  id: "unidade-raiz-de-teste",
  name: "Organização de Teste",
  isRoot: true,
  unitType: null,
  directMembers: [],
  children: [],
};

// motivo: a árvore de espaços era `EXEMPLO_ESPACOS` local até o plano 05
// passar a lê-la de `GET /spaces` — os dados de exemplo migraram para cá,
// no formato da API (aninhado em `children`), para os casos de esqueleto e
// acessibilidade continuarem medindo a árvore sem bater na API real com o
// cookie falso acima.
type EspacoDeTeste = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "UNIT" | "FREE";
  unitId: string | null;
  managerId: string | null;
  restricted: boolean;
  inheritsFromParent: boolean;
};

const ESPACOS_DE_TESTE: EspacoDeTeste[] = [
  { id: "produto", name: "Produto", parentId: null, kind: "UNIT", unitId: "unidade-produto", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "design", name: "Design", parentId: "produto", kind: "UNIT", unitId: "unidade-design", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "engenharia", name: "Engenharia", parentId: "produto", kind: "UNIT", unitId: "unidade-engenharia", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "backend", name: "Backend", parentId: "engenharia", kind: "UNIT", unitId: "unidade-backend", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "frontend", name: "Frontend", parentId: "engenharia", kind: "UNIT", unitId: "unidade-frontend", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "operacoes", name: "Operações", parentId: null, kind: "UNIT", unitId: "unidade-operacoes", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "financeiro", name: "Financeiro", parentId: "operacoes", kind: "UNIT", unitId: "unidade-financeiro", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "pessoas", name: "Pessoas", parentId: "operacoes", kind: "UNIT", unitId: "unidade-pessoas", managerId: null, restricted: false, inheritsFromParent: false },
  { id: "comite-seguranca", name: "Comitê de Segurança", parentId: null, kind: "FREE", unitId: null, managerId: PESSOA_DE_TESTE.id, restricted: true, inheritsFromParent: false },
];

function espacoComoNo(espaco: EspacoDeTeste): Record<string, unknown> {
  return {
    id: espaco.id,
    kind: espaco.kind,
    name: espaco.name,
    unitId: espaco.unitId,
    restricted: espaco.restricted,
    inheritsFromParent: espaco.inheritsFromParent,
    managerId: espaco.managerId,
    children: ESPACOS_DE_TESTE.filter((filho) => filho.parentId === espaco.id).map(
      espacoComoNo,
    ),
  };
}

const ARVORE_DE_ESPACOS = ESPACOS_DE_TESTE.filter(
  (espaco) => espaco.parentId === null,
).map(espacoComoNo);

function detalheDoEspaco(
  id: string,
): Record<string, unknown> | null {
  const espaco = ESPACOS_DE_TESTE.find((candidato) => candidato.id === id);
  if (!espaco) {
    return null;
  }
  const caminho: Array<{ id: string; name: string }> = [];
  let atual: EspacoDeTeste | undefined = espaco;
  while (atual) {
    caminho.unshift({ id: atual.id, name: atual.name });
    const paiId: string | null = atual.parentId;
    atual =
      paiId === null
        ? undefined
        : ESPACOS_DE_TESTE.find((candidato) => candidato.id === paiId);
  }
  return {
    id: espaco.id,
    kind: espaco.kind,
    name: espaco.name,
    unitId: espaco.unitId,
    parentId: espaco.parentId,
    restricted: espaco.restricted,
    inheritsFromParent: espaco.inheritsFromParent,
    managerId: espaco.managerId,
    path: caminho,
  };
}

// motivo: a resposta é servida a uma origem diferente da que a pede, e o
// navegador aplica CORS mesmo quando quem responde é o próprio Playwright. Sem
// estes cabeçalhos o dublê é entregue e descartado antes de o JavaScript vê-lo,
// e o sintoma é uma sessão que nunca chega — longe da causa.
function cabecalhosDeOrigem(origem: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };
}

async function instalarRotaJson(
  page: Page,
  caminho: string,
  origem: string,
  corpo: unknown,
): Promise<void> {
  await page.route(caminho, async (rota) => {
    if (rota.request().method() === "OPTIONS") {
      await rota.fulfill({ status: 204, headers: cabecalhosDeOrigem(origem) });
      return;
    }
    await rota.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cabecalhosDeOrigem(origem),
      body: JSON.stringify(corpo),
    });
  });
}

export async function instalarSessao(
  page: Page,
  origem: string,
): Promise<void> {
  await instalarRotaJson(page, CAMINHO_DA_SESSAO, origem, SESSAO_DE_TESTE);
  // motivo: `OrganizacaoRoute` (etapa 4 do plano 03) e o bloco "Instância"
  // leem estas rotas por `GET /me`, `GET /units`, `GET /unit-types`, `GET
  // /users` e `GET /organization` — sem o dublê, `esqueleto.spec.ts`/
  // `a11y.spec.ts`/`health.spec.ts` bateriam na API real com o cookie falso
  // acima e cairiam no estado de erro ou 401, que nenhum desses casos mede.
  await instalarRotaJson(page, "**/me", origem, ME_DE_TESTE);
  await instalarRotaJson(page, "**/units", origem, UNIDADES_DE_TESTE);
  await instalarRotaJson(page, "**/unit-types", origem, []);
  await instalarRotaJson(page, "**/users*", origem, []);
  await instalarRotaJson(page, "**/organization", origem, ORGANIZACAO_DE_TESTE);
  // motivo: o bloco "Pessoas" (etapa 4 do plano 04) lê `GET /invitations` com
  // `role="status"` enquanto carrega — sem o dublê, a resposta 401 da API
  // real levaria as tentativas padrão do TanStack Query além do tempo de
  // espera de `health.spec.ts`, e o "Carregando convites…" ficaria ambíguo
  // com o status do bloco "Instância" que aquele caso já lê por papel.
  await instalarRotaJson(page, "**/invitations", origem, []);
  // motivo: a barra lateral, `/espacos` e `/espacos/:id` leem `GET /spaces` e
  // `GET /spaces/:id` desde o plano 05 — o mesmo 401 da API real derrubaria a
  // árvore de `esqueleto.spec.ts` no vazio e a página de espaço de
  // `a11y.spec.ts` em "Espaço não encontrado". O detalhe responde 404 para id
  // desconhecido, o mesmo contrato da rota real.
  await instalarRotaJson(page, "**/spaces", origem, ARVORE_DE_ESPACOS);
  await page.route("**/spaces/*", async (rota) => {
    if (rota.request().method() === "OPTIONS") {
      await rota.fulfill({ status: 204, headers: cabecalhosDeOrigem(origem) });
      return;
    }
    const id = new URL(rota.request().url()).pathname.split("/").pop() ?? "";
    const detalhe = detalheDoEspaco(id);
    await rota.fulfill({
      status: detalhe ? 200 : 404,
      contentType: "application/json",
      headers: cabecalhosDeOrigem(origem),
      body: JSON.stringify(
        detalhe ?? { code: "SPACE_NOT_FOUND", message: "Espaço não encontrado" },
      ),
    });
  });
  await instalarRotaJson(page, "**/spaces/*/members", origem, []);
  // motivo: o interruptor "Espaços novos herdam do pai" (plano 05) lê `GET
  // /organization/settings` — sem o dublê, o "Carregando preferências…"
  // (`role="status"`) da espera falhada ficava ao lado do `role="status"` do
  // `HealthStatus` e `health.spec.ts` morria em violação de modo estrito.
  await instalarRotaJson(
    page,
    "**/organization/settings",
    origem,
    { spacesInheritByDefault: false },
  );
}

// O assunto destes casos é o esqueleto e a acessibilidade dele, não a
// autenticação — a sessão aqui é pré-condição, e pré-condição se estabelece na
// fronteira de rede. Quem prova o fluxo real de entrada é `entrar.spec.ts`,
// contra a API de verdade.
export const test = base.extend<{ sessao: void }>({
  sessao: [
    async ({ page, baseURL }, use) => {
      await instalarSessao(page, baseURL ?? "http://localhost:4173");
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
export { PESSOA_DE_TESTE, SESSAO_DE_TESTE };
