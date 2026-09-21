import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * Módulo já compilado (por exemplo, o `TestingModule` do `@nestjs/testing`),
 * usado pelos testes para trocar provedores como o `PrismaService`.
 */
type CompiledModule = {
  createNestApplication: () => INestApplication;
};

export type CreateAppOverrides = {
  module?: CompiledModule;
};

/** Aplica ao app a configuração que vale tanto em produção quanto nos testes. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');

  return app;
}

/** Cria o app configurado, sem escutar porta. */
export async function createApp(
  overrides?: CreateAppOverrides,
): Promise<INestApplication> {
  const app = overrides?.module
    ? overrides.module.createNestApplication()
    : await NestFactory.create(AppModule);

  configureApp(app);

  await app.init();

  return app;
}
