import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { attachCollab } from './collab/attach-collab';
import { HttpExceptionFilter } from './common/http-exception.filter';

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
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());

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

  // Para o `onModuleDestroy` do `collab` gravar o pendente no SIGTERM.
  app.enableShutdownHooks();

  await app.init();

  // Depois do `init`: o servidor HTTP e o `CollabService` já existem.
  attachCollab(app);

  return app;
}
