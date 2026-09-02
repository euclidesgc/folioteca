import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { startTestApp, truncateAll, type TestApp } from './test-app';
import { seedUser, type SeededUser } from './seed';

describe('POST /v1/features', () => {
  let context: TestApp;
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: SeededUser;

  beforeAll(async () => {
    context = await startTestApp();
    app = context.app;
    prisma = context.prisma;
  }, 120_000);

  afterAll(async () => {
    await context.stop();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    owner = await seedUser(prisma, { email: 'owner@example.com' });
  });

  it('deve devolver 201 e persistir a feature do dono autenticado', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/features')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'reports' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'reports' });

    const stored = await prisma.feature.findMany({ where: { ownerId: owner.id } });
    expect(stored).toHaveLength(1);
  });

  it('deve devolver 409 FEATURE_NAME_TAKEN e não criar nada quando o nome se repete', async () => {
    await prisma.feature.create({ data: { ownerId: owner.id, name: 'reports' } });

    const response = await request(app.getHttpServer())
      .post('/v1/features')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'reports' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FEATURE_NAME_TAKEN');
    expect(await prisma.feature.count({ where: { ownerId: owner.id } })).toBe(1);
  });

  it('deve devolver 400 quando o corpo traz campo não declarado no DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/features')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'reports', ownerId: 'someone-else' });

    expect(response.status).toBe(400);
  });

  it('deve devolver 401 quando a requisição chega sem token', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/features')
      .send({ name: 'reports' });

    expect(response.status).toBe(401);
  });

  it('deve devolver o código do erro sem expor a mensagem interna da exceção', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/features/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'FEATURE_NOT_FOUND',
      correlationId: expect.any(String),
    });
  });
});
