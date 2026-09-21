import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../app.module';
import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { httpRequest } from '../../../test/http';

test('GET /api/health returns 200 with status ok and database up', async () => {
  const app = await createApp();

  const response = await httpRequest(app).get('/api/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: { status: 'ok', database: 'up' } });

  await app.close();
});

test('GET /health without the api prefix returns 404', async () => {
  const app = await createApp();

  const response = await httpRequest(app).get('/health');

  expect(response.status).toBe(404);

  await app.close();
});

test('the vector extension is installed in the database', async () => {
  const app = await createApp();
  const prisma = app.get(PrismaService);

  const rows = await prisma.$queryRaw<
    Array<{ extname: string }>
  >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;

  expect(rows).toHaveLength(1);

  await app.close();
});

test('GET /api/health returns 503 with the unavailable message when the database query rejects', async () => {
  const failingPrisma = {
    $queryRaw: vi.fn().mockRejectedValue(new Error('database unavailable')),
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(failingPrisma)
    .compile();

  let app: INestApplication | undefined;

  try {
    app = await createApp({ module: moduleRef });

    const response = await httpRequest(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      message: 'Banco de dados indisponível.',
    });
  } finally {
    await app?.close();
  }
});
