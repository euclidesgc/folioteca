import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AUTH_INSTANCE } from '../src/auth/auth.constants';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ROUTE_MODULES } from '../src/route-modules';
import { buildOpenApiDocument } from '../src/swagger';

// contorno: o PrismaService real injeta ConfigService e exigiria DATABASE_URL só para o documento ser escrito; o AUTH_INSTANCE real dependeria das mesmas três infraestruturas (Prisma, Config, Mail); o InstallationService lê INSTALLATION_CODE do mesmo ConfigService. Os três dublês entram pelo mesmo módulo global de onde os verdadeiros viriam, porque quem os injeta é provider ou guard de algum módulo de rota e resolve no escopo dele.
@Global()
@Module({
  providers: [
    { provide: PrismaService, useValue: {} },
    { provide: AUTH_INSTANCE, useValue: {} },
    { provide: ConfigService, useValue: {} },
  ],
  exports: [PrismaService, AUTH_INSTANCE, ConfigService],
})
class PrismaStubModule {}

// contorno: o documento descreve rotas e schemas, não o ambiente de execução; um módulo com só os módulos de rota deixa o job de contrato do CI livre de DATABASE_URL/NODE_ENV.
@Module({ imports: [PrismaStubModule, HealthModule, ...ROUTE_MODULES] })
class OpenApiModule {}

const OUTPUT = resolve(__dirname, '..', 'openapi.json');

async function generate(): Promise<void> {
  const app = await NestFactory.create(OpenApiModule, { logger: false });
  const document = buildOpenApiDocument(app);
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
}

void generate();
