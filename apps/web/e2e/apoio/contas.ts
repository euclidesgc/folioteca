import path from "node:path";
import { fileURLToPath } from "node:url";

const PASTA_DE_ESTADO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.auth",
);

// motivo: o caminho mora à parte do projeto de setup que os escreve — um
// arquivo de teste não pode importar outro arquivo de teste no Playwright, e
// `organizacao-admin.spec.ts`/`organizacao-membro.spec.ts`/`documentos.spec.ts`
// precisam do mesmo caminho que `instalacao.setup.ts` grava.
export const ARQUIVO_ADMIN = path.join(PASTA_DE_ESTADO, "admin.json");
export const ARQUIVO_MEMBRO = path.join(PASTA_DE_ESTADO, "membro.json");

// decisão: o cadastro público fechou (plano 03) — a mesma administradora e a
// mesma pessoa membro cobrem também os papéis que `documentos.spec.ts` (plano
// 02) media com duas contas criadas à parte; quatro contas paralelas não
// testariam nada que duas não testem.
export const ARQUIVO_DONA_DO_DOCUMENTO = ARQUIVO_ADMIN;
export const ARQUIVO_OUTRA_PESSOA = ARQUIVO_MEMBRO;
