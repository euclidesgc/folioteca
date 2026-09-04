import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureCors } from "./cors";
import type { EnvironmentVariables } from "./config/environment-variables";

export type BootstrappedApp = {
  app: INestApplication;
  config: ConfigService<EnvironmentVariables, true>;
};

export async function createApp(): Promise<BootstrappedApp> {
  // contorno: o padrão de `NestFactory.create` é `abortOnError: true`, que chama `process.abort()` (SIGABRT, sem chance de captura) em vez de rejeitar a promise num erro de inicialização; `abortOnError: false` é o que permite quem chama `createApp()` sem passar por `validateEnvironmentOrExit()` — todo e2e — tratar o erro em vez de derrubar o processo.
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  // motivo: HSTS fica ligada só em produção porque, emitida em http://localhost:3000, ela fixa no navegador de quem desenvolve uma regra que persiste em cache.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      xFrameOptions: { action: "deny" },
      strictTransportSecurity:
        config.get("NODE_ENV", { infer: true }) === "production"
          ? { maxAge: 31536000, includeSubDomains: true }
          : false,
    }),
  );
  configureCors(app, config);
  return { app, config };
}
