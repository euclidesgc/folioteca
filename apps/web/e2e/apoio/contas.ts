import path from "node:path";
import { fileURLToPath } from "node:url";

const PASTA_DE_ESTADO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../setup/.auth",
);

// motivo: o caminho mora à parte do projeto de setup que os escreve — um
// arquivo de teste não pode importar outro arquivo de teste no Playwright, e
// `documentos.spec.ts` precisa do mesmo caminho que `autenticar.setup.ts`
// grava.
export const ARQUIVO_DONA_DO_DOCUMENTO = path.join(
  PASTA_DE_ESTADO,
  "dona-do-documento.json",
);
export const ARQUIVO_OUTRA_PESSOA = path.join(
  PASTA_DE_ESTADO,
  "outra-pessoa.json",
);
