import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseEnvFile } from "dotenv";
import { defineConfig } from "prisma/config";

// motivo: o repositório mantém um único `.env` na raiz, e o Prisma CLI só lê o
// que estiver ao lado do schema ou no diretório de trabalho — sem esta leitura
// explícita, migration nenhuma encontra a URL de conexão.
const ENV_FILE_PATH = resolve(__dirname, "..", "..", ".env");
const fromFile = existsSync(ENV_FILE_PATH)
  ? parseEnvFile(readFileSync(ENV_FILE_PATH))
  : {};

export default defineConfig({
  schema: resolve(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: resolve(__dirname, "prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? fromFile.DATABASE_URL,
  },
});
