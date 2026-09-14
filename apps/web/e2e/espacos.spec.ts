import { expect, test } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { ARQUIVO_ADMIN, ARQUIVO_COLEGA, ARQUIVO_MEMBRO } from "./apoio/contas";
import { PESSOA_ADMIN, PESSOA_COLEGA, PESSOA_MEMBRO } from "./apoio/pessoas";
import { API_URL, WEB_URL } from "../playwright.config";

// por quê: a suíte é `fullyParallel`, e os dois casos deste arquivo se
// interferem por estado da instância inteira — o interruptor de herança
// ligado pelo segundo vazava para o Given do primeiro (Financeiro nascia com
// `inheritsFromParent = true`, e a administração alcançava o espaço restrito
// pela herança). Medido na execução de 13/09/2026: início a 400 ms um do
// outro, e a falha era na criação, não na regra. Serial dentro do arquivo;
// o resto da suíte segue paralelo.
test.describe.configure({ mode: "serial" });

// motivo: cada caso abre as próprias sessões por `browser.newContext`, como
// `documentos.spec.ts` — o `storageState` de quem entra em cena aqui é dado de
// entrada do cenário, não herança do projeto.
async function comoPessoa(
  browser: import("@playwright/test").Browser,
  arquivoDeEstado: string,
): Promise<BrowserContext> {
  return browser.newContext({ storageState: arquivoDeEstado, baseURL: WEB_URL });
}

// motivo: o nome da unidade é único por mãe (plano 03), e a suíte tolera rodar
// de novo contra o mesmo banco sem `scripts/e2e/banco-limpo.sh` — criar
// "Financeiro" quando ele já existe falha com `UNIT_NAME_TAKEN`, então a
// existência se confere pela API antes de abrir a UI de criação.
async function jaExisteUnidadeFinanceiro(
  contexto: BrowserContext,
): Promise<boolean> {
  const raiz = (await (
    await contexto.request.get(`${API_URL}/units`)
  ).json()) as { children?: Array<{ name: string }> };
  return (raiz.children ?? []).some((filha) => filha.name === "Financeiro");
}

// motivo: a unidade "Financeiro" e a lotação da pessoa membro são o Given do
// primeiro caso, e a UI de `/organizacao` é quem as cria — o mesmo caminho de
// `organizacao-admin.spec.ts`.
async function criarUnidadeFinanceiroELotarMembro(
  contextoAdmin: BrowserContext,
  paginaAdmin: Page,
): Promise<void> {
  await paginaAdmin.goto("/organizacao");
  await expect(
    paginaAdmin.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();

  if (!(await jaExisteUnidadeFinanceiro(contextoAdmin))) {
    const sufixo = `${Date.now()}`;
    const nomeDoTipo = `Tipo de teste ${sufixo}`;

    await paginaAdmin.getByRole("button", { name: "Tipos de unidade" }).click();
    const dialogoDeTipos = paginaAdmin.getByRole("dialog", {
      name: "Tipos de unidade",
    });
    await dialogoDeTipos.getByLabel("Novo tipo de unidade").fill(nomeDoTipo);
    await dialogoDeTipos.getByRole("button", { name: "Acrescentar" }).click();
    await expect(dialogoDeTipos.getByText(nomeDoTipo)).toBeVisible();
    await dialogoDeTipos.getByRole("button", { name: "Fechar" }).click();
    await expect(dialogoDeTipos).toBeHidden();

    // por quê: a raiz é o primeiro nó a renderizar as próprias ações — antes
    // de qualquer unidade filha existir, é o único "Criar unidade aqui" na
    // página, e continua sendo o primeiro em ordem de documento mesmo que a
    // suíte rode mais de uma vez sem `scripts/e2e/banco-limpo.sh`.
    await paginaAdmin
      .getByRole("button", { name: "Criar unidade aqui" })
      .first()
      .click();
    const dialogoDeUnidade = paginaAdmin.getByRole("dialog", {
      name: "Criar unidade",
    });
    await dialogoDeUnidade.getByLabel("Nome da unidade").fill("Financeiro");
    await dialogoDeUnidade
      .getByRole("combobox", { name: "Tipo de unidade" })
      .click();
    await paginaAdmin.getByRole("option", { name: nomeDoTipo }).click();
    await dialogoDeUnidade.getByRole("button", { name: "Criar" }).click();
    await expect(dialogoDeUnidade).toBeHidden();
  }

  // por quê: o "Financeiro" desta execução é o último "Financeiro" em ordem de
  // documento — o `.last()` acerta o recém-criado quando ele acabou de nascer
  // e o único existente quando a suíte reusa o banco de uma execução
  // anterior. A lotação é idempotente no servidor (upsert).
  const noDoFinanceiro = paginaAdmin
    .getByRole("listitem")
    .filter({ hasText: "Financeiro" })
    .last();
  await expect(noDoFinanceiro).toBeVisible();

  await noDoFinanceiro.getByRole("button", { name: "Lotar pessoa" }).click();
  const dialogoDeLotacao = paginaAdmin.getByRole("dialog", {
    name: "Lotar pessoa",
  });
  await dialogoDeLotacao
    .getByLabel("Buscar por nome ou e-mail")
    .fill(PESSOA_MEMBRO.name);
  await dialogoDeLotacao
    .getByRole("listitem")
    .filter({ hasText: PESSOA_MEMBRO.name })
    .getByRole("button", { name: "Lotar aqui" })
    .click();
  await dialogoDeLotacao.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogoDeLotacao).toBeHidden();
}

test("member creates a restricted free space and only the invited colleague sees it", async ({
  browser,
}) => {
  const contextoAdmin = await comoPessoa(browser, ARQUIVO_ADMIN);
  // por quê: o padrão de herança é estado da instância, não do caso — uma
  // execução anterior contra o mesmo banco (sem `banco-limpo.sh`) pode tê-lo
  // deixado ligado, e com ele ligado o espaço restrito nasceria herdando do
  // pai, alcançável pela administração. O Given deste caso é "desligado".
  await contextoAdmin.request.patch(`${API_URL}/organization/settings`, {
    data: { spacesInheritByDefault: false },
  });
  const paginaAdmin = await contextoAdmin.newPage();
  await criarUnidadeFinanceiroELotarMembro(contextoAdmin, paginaAdmin);
  await contextoAdmin.close();

  const contextoMembro = await comoPessoa(browser, ARQUIVO_MEMBRO);
  const paginaMembro = await contextoMembro.newPage();
  const sufixo = `${Date.now()}`;
  const nomeDoEspaco = `Orçamento restrito ${sufixo}`;

  await paginaMembro.goto("/espacos");
  await expect(
    paginaMembro.getByRole("heading", { level: 1, name: "Espaços" }),
  ).toBeVisible();

  const criado = paginaMembro.waitForResponse(
    (resposta) =>
      resposta.request().method() === "POST" &&
      new URL(resposta.url()).pathname === "/spaces",
  );

  await paginaMembro.getByRole("button", { name: "Criar espaço" }).click();
  const dialogo = paginaMembro.getByRole("dialog", { name: "Criar espaço" });
  await dialogo.getByLabel("Nome").fill(nomeDoEspaco);
  await dialogo.getByRole("combobox", { name: "Onde" }).click();
  await paginaMembro.getByRole("option", { name: "Financeiro" }).last().click();
  // por quê: o alternador expõe o estado por um input escondido atrás do
  // controle visível — clicar no input é recusado pelo Playwright (o controle
  // intercepta o ponteiro), e o rótulo é o que a pessoa clica de verdade.
  await dialogo
    .getByText("Restrito — só quem eu convidar vê este espaço", { exact: true })
    .click();
  await dialogo.getByRole("button", { name: "Criar espaço" }).click();
  await expect(dialogo).toBeHidden();

  const espaco = (await (await criado).json()) as {
    id: string;
    parentId: string;
  };

  await paginaMembro.goto(`/espacos/${espaco.id}`);
  await expect(
    paginaMembro.getByRole("heading", { level: 1, name: nomeDoEspaco }),
  ).toBeVisible();

  await paginaMembro.getByRole("button", { name: "Editar" }).click();
  await paginaMembro
    .getByRole("menuitem", { name: "Gerenciar membros" })
    .click();
  const dialogoDeMembros = paginaMembro.getByRole("dialog", {
    name: `Membros de ${nomeDoEspaco}`,
  });
  await dialogoDeMembros
    .getByRole("combobox", { name: "Adicionar pessoa" })
    .click();
  await paginaMembro
    .getByRole("option", { name: PESSOA_COLEGA.name })
    .click();
  await dialogoDeMembros.getByRole("button", { name: "Adicionar" }).click();
  await expect(
    dialogoDeMembros.getByRole("listitem").filter({
      hasText: PESSOA_COLEGA.name,
    }),
  ).toBeVisible();
  await dialogoDeMembros.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogoDeMembros).toBeHidden();
  await contextoMembro.close();

  // a colega convidada vê o espaço na própria árvore — a raiz e o
  // "Financeiro" precisam ser expandidos primeiro, porque o espaço do
  // convite é neto da raiz.
  const contextoColega = await comoPessoa(browser, ARQUIVO_COLEGA);
  const paginaColega = await contextoColega.newPage();
  await paginaColega.goto("/espacos");
  await paginaColega
    .getByRole("button", { name: `Expandir ${PESSOA_ADMIN.organizationName}` })
    .click();
  await paginaColega
    .getByRole("button", { name: "Expandir Financeiro" })
    .last()
    .click();
  await expect(
    paginaColega
      .getByRole("complementary")
      .getByRole("link", { name: nomeDoEspaco }),
  ).toBeVisible();
  await contextoColega.close();

  // a administração, sem convite, não vê: dentro do "Financeiro" de cima do
  // qual o espaço nasceu, a lista de subespaços não o traz — e no endereço
  // direto o servidor responde 404, o mesmo estado de um id desconhecido.
  // por quê: o `parentId` da resposta da criação é o "Financeiro" certo, sem
  // depender de qual "Financeiro" é o último na árvore de quem olha.
  const contextoSemConvite = await comoPessoa(browser, ARQUIVO_ADMIN);
  const paginaSemConvite = await contextoSemConvite.newPage();
  await paginaSemConvite.goto(`/espacos/${espaco.parentId}`);
  await expect(
    paginaSemConvite.getByRole("heading", { level: 1, name: "Financeiro" }),
  ).toBeVisible();
  await expect(
    paginaSemConvite.getByRole("link", { name: nomeDoEspaco }),
  ).toHaveCount(0);

  await paginaSemConvite.goto(`/espacos/${espaco.id}`);
  await expect(
    paginaSemConvite.getByRole("heading", { level: 2, name: "Espaço não encontrado" }),
  ).toBeVisible();
  await contextoSemConvite.close();
});

test("administration turns on the default inheritance switch and it survives a reload", async ({
  browser,
}) => {
  const contexto = await comoPessoa(browser, ARQUIVO_ADMIN);
  const pagina = await contexto.newPage();

  await pagina.goto("/organizacao");
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();

  const interruptor = pagina.getByRole("switch", {
    name: "Espaços novos herdam do pai",
  });
  await expect(interruptor).toBeVisible();

  // por quê: a preferência nasce desligada, mas uma execução anterior contra
  // o mesmo banco pode tê-la deixado ligada — o alvo deste caso é a subida
  // de false para true, e desligar antes é o que garante o ponto de partida.
  // por quê: o alternador expõe o estado por um input escondido atrás do
  // controle visível — o rótulo é o que a pessoa clica, e o input escondido
  // é o que responde por `isChecked`.
  const rotulo = pagina.getByText("Espaços novos herdam do pai", {
    exact: true,
  });

  if (await interruptor.isChecked()) {
    await rotulo.click();
    await expect(interruptor).not.toBeChecked();
  }

  await rotulo.click();
  await expect(interruptor).toBeChecked();
  await expect(pagina.getByText("Preferência salva.").first()).toBeVisible();

  await pagina.reload();
  await expect(
    pagina.getByRole("heading", { level: 1, name: "Organização" }),
  ).toBeVisible();
  await expect(interruptor).toBeChecked();

  await contexto.close();
});
