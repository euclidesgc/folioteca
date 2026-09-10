import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildOpenApiDocument } from '../src/swagger';

// contorno: o PrismaService real injeta ConfigService e exigiria DATABASE_URL só para o documento ser escrito. O dublê entra pelo mesmo módulo global de onde o verdadeiro viria, porque quem o injeta é provider de HealthModule e resolve no escopo dele.
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class PrismaStubModule {}

// contorno: o documento descreve rotas e schemas, não o ambiente de execução; um módulo com só os módulos de rota deixa o job de contrato do CI livre de DATABASE_URL/NODE_ENV.
@Module({ imports: [PrismaStubModule, HealthModule] })
class OpenApiModule {}

const OUTPUT = resolve(__dirname, '..', 'openapi.json');

async function generate(): Promise<void> {
  const app = await NestFactory.create(OpenApiModule, { logger: false });
  const document = buildOpenApiDocument(app);
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
}

void generate();
