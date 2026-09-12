import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

const POSTGRES_IMAGE = "pgvector/pgvector:pg16";
const API_ROOT = resolve(__dirname, "..", "..");

let container: StartedPostgreSqlContainer | undefined;

export async function iniciarBanco(): Promise<StartedPostgreSqlContainer> {
  const instancia = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase("folioteca_test")
    .withUsername("folioteca")
    .withPassword("senha")
    .start();

  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: instancia.getConnectionUri() },
    stdio: "inherit",
  });

  return instancia;
}

export async function pararBanco(instancia: StartedPostgreSqlContainer): Promise<void> {
  await instancia.stop();
}

// contorno: `globalSetup`/`globalTeardown` do Jest exigem um módulo por função
// (`transformer.requireAndTranspileModule` chama o export diretamente, sem
// aceitar um nome). A variável de módulo é o elo entre as duas chamadas — o
// mesmo processo principal do Jest (por isso `--runInBand`) requer este
// arquivo duas vezes, e o cache de módulo do Node devolve a mesma instância.
export async function globalSetup(): Promise<void> {
  container = await iniciarBanco();
  process.env.DATABASE_URL = container.getConnectionUri();
}

export async function globalTeardown(): Promise<void> {
  if (container) {
    await pararBanco(container);
  }
}
