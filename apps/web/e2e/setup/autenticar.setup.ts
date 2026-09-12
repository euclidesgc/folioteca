import { test as setup, type Page } from "@playwright/test";
import { ARQUIVO_DONA_DO_DOCUMENTO, ARQUIVO_OUTRA_PESSOA } from "../apoio/contas";
import { linkDeConfirmacao } from "../apoio/mailpit";

const SENHA = "uma-senha-de-teste-bem-longa";

function enderecoUnico(etiqueta: string): string {
  return `${etiqueta}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.folioteca`;
}

async function criarContaEEntrar(
  page: Page,
  nome: string,
  nomeDaEmpresa: string,
  email: string,
): Promise<void> {
  await page.goto("/criar-conta");
  await page.getByRole("textbox", { name: "Seu nome" }).fill(nome);
  await page
    .getByRole("textbox", { name: "Nome da empresa" })
    .fill(nomeDaEmpresa);
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page
    .getByText("Se houver uma conta a criar com esse endereço")
    .waitFor();

  const link = await linkDeConfirmacao(email);
  // por quê: confirmar é uma chamada HTTP simples contra a API — navegar o
  // navegador até lá troca de origem para uma página que o artefato da web
  // nunca precisa servir, e que a CSP dele não declara.
  const confirmacao = await page.request.get(link, { maxRedirects: 0 });
  if (![200, 302, 303].includes(confirmacao.status())) {
    throw new Error(
      `confirmação de e-mail devolveu ${confirmacao.status()} para ${email}`,
    );
  }

  await page.goto("/entrar");
  await page.getByRole("textbox", { name: "E-mail" }).fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/documentos");
}

setup("autentica a dona do documento", async ({ page }) => {
  const email = enderecoUnico("dona-do-documento");
  await criarContaEEntrar(page, "Dona do Documento", "Empresa da Dona", email);
  await page.context().storageState({ path: ARQUIVO_DONA_DO_DOCUMENTO });
});

setup("autentica outra pessoa", async ({ page }) => {
  const email = enderecoUnico("outra-pessoa");
  await criarContaEEntrar(
    page,
    "Outra Pessoa",
    "Empresa da Outra Pessoa",
    email,
  );
  await page.context().storageState({ path: ARQUIVO_OUTRA_PESSOA });
});
