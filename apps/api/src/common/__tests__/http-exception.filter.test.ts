import 'reflect-metadata';

import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { createApp } from '../../create-app';
import { httpRequest } from '../../../test/http';

const LEAKED_DETAIL = 'detalhe interno da conexão';

@Controller('probe')
class ProbeController {
  @Get('http-exception')
  httpException(): never {
    throw new ForbiddenException('Requisição recusada.');
  }

  @Get('validation')
  validation(): never {
    throw new BadRequestException({
      message: 'Dados inválidos.',
      errors: [{ field: 'name', message: 'Informe o seu nome.' }],
    });
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error(LEAKED_DETAIL);
  }
}

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
  }).compile();

  app = await createApp({ module: moduleRef });
});

afterAll(async () => {
  await app.close();
});

test('answers an HttpException with its status and message only', async () => {
  const response = await httpRequest(app).get('/api/probe/http-exception');

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
});

test('keeps the errors array of a validation error', async () => {
  const response = await httpRequest(app).get('/api/probe/validation');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'name', message: 'Informe o seu nome.' }],
  });
});

test('answers an unknown route with 404 Recurso não encontrado.', async () => {
  const response = await httpRequest(app).get('/api/probe/inexistente');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Recurso não encontrado.' });
});

test('answers an unexpected error with 500 Erro interno do servidor. without leaking details', async () => {
  // O filtro registra o erro inesperado: o espião evita o log na saída.
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});

  try {
    const response = await httpRequest(app).get('/api/probe/unexpected');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
    expect(response.text).not.toContain(LEAKED_DETAIL);
    expect(response.text).not.toContain('stack');
    expect(response.text).not.toContain('Error');
  } finally {
    logError.mockRestore();
  }
});

test('logs the unexpected error', async () => {
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => {});

  try {
    await httpRequest(app).get('/api/probe/unexpected');

    expect(logError).toHaveBeenCalled();
  } finally {
    logError.mockRestore();
  }
});
