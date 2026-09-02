import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseEnvFile } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { environmentSchema } from './config/environment.schema';
import type { EnvironmentVariables } from './config/environment-variables';

const ENV_FILE_PATH = resolve(__dirname, '..', '..', '..', '.env');

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_FILE_PATH)) {
    return {};
  }
  return parseEnvFile(readFileSync(ENV_FILE_PATH));
}

function validateEnvironmentOrExit(): void {
  const merged = { ...readEnvFile(), ...process.env };
  const { error } = environmentSchema.validate(merged, {
    abortEarly: false,
    allowUnknown: true,
  });
  if (!error) {
    return;
  }
  // contorno: a linha se monta de detail.path e detail.type, nunca de detail.message, para que nenhum valor validado vaze caso a regra do schema mude.
  for (const detail of error.details) {
    const name = detail.path.join('.');
    console.error(detail.type === 'any.required' ? `${name} is required` : `${name} is invalid`);
  }
  process.exit(1);
}

async function bootstrap(): Promise<void> {
  validateEnvironmentOrExit();

  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
