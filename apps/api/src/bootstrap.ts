import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { json } from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AUTH_BASE_PATH, AUTH_INSTANCE } from "./auth/auth.constants";
import type { Auth } from "./auth/auth.factory";
import { configureCors } from "./cors";
import type { EnvironmentVariables } from "./config/environment-variables";

export type BootstrappedApp = {
  app: INestApplication;
  config: ConfigService<EnvironmentVariables, true>;
};

export async function createApp(): Promise<BootstrappedApp> {
  // contorno: o padrão de `NestFactory.create` é `abortOnError: true`, que chama `process.abort()` (SIGABRT, sem chance de captura) em vez de rejeitar a promise num erro de inicialização; `abortOnError: false` é o que permite quem chama `createApp()` sem passar por `validateEnvironmentOrExit()` — todo e2e — tratar o erro em vez de derrubar o processo.
  // contorno: `bodyParser: false` porque o handler de autenticação lê o corpo cru da requisição; o parser global do Nest o consumiria antes, e o handler receberia um fluxo já esvaziado.
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    bodyParser: false,
  });
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
  app.use(AUTH_BASE_PATH, toNodeHandler(app.get<Auth>(AUTH_INSTANCE)));
  app.use(json());
  return { app, config };
}
