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

export async function instalarSessao(
  page: Page,
  origem: string,
): Promise<void> {
  await page.route(CAMINHO_DA_SESSAO, async (rota) => {
    if (rota.request().method() === "OPTIONS") {
      await rota.fulfill({ status: 204, headers: cabecalhosDeOrigem(origem) });
      return;
    }
    await rota.fulfill({
      status: 200,
      contentType: "application/json",
      headers: cabecalhosDeOrigem(origem),
      body: JSON.stringify(SESSAO_DE_TESTE),
    });
  });
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
