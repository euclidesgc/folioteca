import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { configureCors } from "./cors";
import type { EnvironmentVariables } from "./config/environment-variables";

export type BootstrappedApp = {
  app: INestApplication;
  config: ConfigService<EnvironmentVariables, true>;
};

export async function createApp(): Promise<BootstrappedApp> {
  const app = await NestFactory.create(AppModule);
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  configureCors(app, config);
  return { app, config };
}
