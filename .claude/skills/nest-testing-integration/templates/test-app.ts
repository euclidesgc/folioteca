import { execSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

export type TestApp = {
  app: INestApplication;
  prisma: PrismaService;
  stop: () => Promise<void>;
};

export async function startTestApp(): Promise<TestApp> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('app_test')
    .withUsername('app')
    .withPassword('app')
    .start();

  // O PrismaService lê DATABASE_URL na construção: a variável precisa apontar
  // para a porta mapeada antes de o módulo Nest ser compilado.
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    stop: async () => {
      await app.close();
      await container.stop();
    },
  };
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Feature", "User" RESTART IDENTITY CASCADE',
  );
}
