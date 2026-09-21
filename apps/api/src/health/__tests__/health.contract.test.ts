import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../app.module';
import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';

test('200 response matches the HealthResponse schema', async () => {
  const app = await createApp();

  const response = await httpRequest(app).get('/api/health');

  await expectMatchesContract({
    path: '/health',
    method: 'get',
    status: response.status,
    body: response.body,
  });

  await app.close();
});

test('503 response matches the Error schema', async () => {
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

    await expectMatchesContract({
      path: '/health',
      method: 'get',
      status: response.status,
      body: response.body,
    });
  } finally {
    await app?.close();
  }
});

test('expectMatchesContract rejects a body that violates the schema', async () => {
  await expect(
    expectMatchesContract({
      path: '/health',
      method: 'get',
      status: 200,
      body: { data: { status: 'unknown', database: 'up' } },
    }),
  ).rejects.toThrow();
});

test('expectMatchesContract rejects a status that is not in the contract', async () => {
  await expect(
    expectMatchesContract({
      path: '/health',
      method: 'get',
      status: 418,
      body: {},
    }),
  ).rejects.toThrow();
});
