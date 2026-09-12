import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup, type Page } from "@playwright/test";
import { ARQUIVO_ADMIN, ARQUIVO_MEMBRO } from "./apoio/contas";
import { PESSOA_ADMIN, PESSOA_MEMBRO } from "./apoio/pessoas";
import {
  API_URL,
  BETTER_AUTH_SECRET,
  DATABASE_URL,
  INSTALLATION_CODE,
} from "../playwright.config";

const RAIZ_DO_REPOSITORIO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function autenticarPorEmail(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const resposta = await page.request.post(
    `${API_URL}/api/auth/sign-in/email`,
    { data: { email, password } },
  );
  if (!resposta.ok()) {
    throw new Error(
      `sign-in/email devolveu ${resposta.status()} para ${email}: ${await resposta.text()}`,
    );
  }
}

setup("instala a instância e autentica a administradora", async ({ page }) => {
  const instalacao = await page.request.post(`${API_URL}/installation`, {
    data: {
      installationCode: INSTALLATION_CODE,
      name: PESSOA_ADMIN.name,
      organizationName: PESSOA_ADMIN.organizationName,
      email: PESSOA_ADMIN.email,
      password: PESSOA_ADMIN.password,
    },
  });

  // por quê: a instalação é de uma vez por instância (M2) — uma segunda
  // execução deste setup contra o mesmo banco (sem `scripts/e2e/banco-
  // limpo.sh` entre elas) encontra a instância já pronta, e a mesma
  // administradora de sempre ainda abre sessão com a mesma senha.
  if (instalacao.status() === 409) {
    await autenticarPorEmail(page, PESSOA_ADMIN.email, PESSOA_ADMIN.password);
  } else if (!instalacao.ok()) {
    throw new Error(
      `POST /installation devolveu ${instalacao.status()}: ${await instalacao.text()}`,
    );
  }

  await page.context().storageState({ path: ARQUIVO_ADMIN });
});

setup("semeia a pessoa membro e autentica", async ({ page }) => {
  // contorno: não há convite ainda (plano 04) e o cadastro público fechou
  // (M2) — a única forma de uma segunda pessoa existir é nascer direto no
  // banco. `apps/api` é quem sabe hashear senha do jeito que `auth.api.
  // signInEmail` depois confere (M2/D5); a suíte da web só invoca o script que
  // já mora lá, como já faz para migrar e gerar o contrato.
  //
  // contorno: `pnpm --filter api run <script> -- <args>` insere um `--`
  // literal na linha de comando encaminhada — `process.argv` do script
  // recebia `["--", nome, email]` e a senha se perdia. `pnpm exec` encaminha
  // os argumentos como vieram, sem essa marca.
  execFileSync(
    "pnpm",
    [
      "--filter",
      "api",
      "exec",
      "ts-node",
      "--transpile-only",
      "scripts/seed-e2e-member.ts",
      PESSOA_MEMBRO.name,
      PESSOA_MEMBRO.email,
      PESSOA_MEMBRO.password,
    ],
    {
      cwd: RAIZ_DO_REPOSITORIO,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL, BETTER_AUTH_SECRET },
    },
  );

  await autenticarPorEmail(page, PESSOA_MEMBRO.email, PESSOA_MEMBRO.password);
  await page.context().storageState({ path: ARQUIVO_MEMBRO });
});
