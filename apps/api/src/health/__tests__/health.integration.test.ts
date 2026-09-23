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
  const body = response.body as { data: Record<string, unknown> };
  expect(body.data).toMatchObject({ status: 'ok', database: 'up' });
  expect(Object.keys(body.data).sort()).toEqual([
    'commit',
    'database',
    'status',
  ]);
  expect(typeof body.data.commit).toBe('string');

  await app.close();
});

/**
 * O `env` é lido quando o módulo carrega; recarrega o app com o ambiente
 * trocado para provar que o `commit` vem de `SOURCE_COMMIT`.
 */
async function getHealthWithSourceCommit(value: string | undefined) {
  vi.stubEnv('SOURCE_COMMIT', value);
  vi.resetModules();

  const { createApp: createFreshApp } = await import('../../create-app');
  const app = await createFreshApp();

  try {
    return await httpRequest(app).get('/api/health');
  } finally {
    await app.close();
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

test('returns commit from SOURCE_COMMIT', async () => {
  const response = await getHealthWithSourceCommit('abc1234');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { status: 'ok', database: 'up', commit: 'abc1234' },
  });
});

test('returns commit unknown when SOURCE_COMMIT is not set', async () => {
  const response = await getHealthWithSourceCommit(undefined);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { status: 'ok', database: 'up', commit: 'unknown' },
  });
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
