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
