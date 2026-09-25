import 'reflect-metadata';

import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { verify } from '@node-rs/argon2';

import { AppModule } from '../../app.module';
import { PasswordService } from '../../auth/password.service';
import { SessionService } from '../../auth/session.service';
import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { InstallationService } from '../installation.service';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const REFUSED_MESSAGE =
  'Não foi possível concluir a instalação. Confira os dados informados.';

/** Código válido: gerado em tempo de execução pelo `global-setup`. */
const validCode: string = process.env.INSTALL_CODE ?? '';

const SESSION_COOKIE_PREFIX = 'folioteca_session=';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

let app: INestApplication;
let prisma: PrismaService;

function validBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    code: validCode,
    organizationName: 'Prefeitura de Exemplo',
    name: 'Maria Souza',
    email: 'maria@exemplo.org',
    password: randomUUID(),
    ...overrides,
  };
}

function postInstallation(
  body: Record<string, unknown>,
): ReturnType<ReturnType<typeof httpRequest>['post']> {
  return httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
}

function findSessionCookie(headers: Record<string, unknown>): string {
  const cookies = (headers['set-cookie'] ?? []) as string[];
  const cookie = cookies.find((item) => item.startsWith(SESSION_COOKIE_PREFIX));

  if (cookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return cookie;
}

function getSessionToken(setCookie: string): string {
  const pair = setCookie.split(';')[0] ?? '';

  return decodeURIComponent(pair.slice(SESSION_COOKIE_PREFIX.length));
}

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

test('GET /api/installation returns installed false on an empty database', async () => {
  const response = await httpRequest(app).get('/api/installation');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: { installed: false } });
});

test('POST /api/installation returns 201 with the person and the organization', async () => {
  const body = validBody();

  const response = await postInstallation(body);

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    data: {
      person: {
        id: ANY_STRING,
        name: 'Maria Souza',
        email: 'maria@exemplo.org',
        isAdmin: true,
        documentPageWidth: 'medium',
      },
      organization: {
        id: ANY_STRING,
        name: 'Prefeitura de Exemplo',
      },
    },
  });
});

test('creates one organization, the root unit, the admin person, the personal space, the unit space and one session', async () => {
  await postInstallation(validBody());

  const organization = await prisma.organization.findFirstOrThrow();
  const rootUnit = await prisma.orgUnit.findFirstOrThrow();
  const person = await prisma.person.findFirstOrThrow();
  const spaces = await prisma.space.findMany({ orderBy: { type: 'asc' } });

  expect(await prisma.organization.count()).toBe(1);
  expect(organization.singleton).toBe(true);
  expect(await prisma.orgUnit.count()).toBe(1);
  expect(rootUnit).toMatchObject({
    organizationId: organization.id,
    parentId: null,
    name: 'Prefeitura de Exemplo',
  });
  expect(await prisma.person.count()).toBe(1);
  expect(person).toMatchObject({
    organizationId: organization.id,
    isAdmin: true,
  });
  expect(spaces).toHaveLength(2);
  expect(spaces[0]).toMatchObject({
    type: 'PERSONAL',
    personId: person.id,
    orgUnitId: null,
  });
  expect(spaces[1]).toMatchObject({
    type: 'UNIT',
    personId: null,
    orgUnitId: rootUnit.id,
  });
  expect(await prisma.session.count()).toBe(1);
});

test('stores the password as an argon2id hash and never the plain text', async () => {
  const body = validBody();

  await postInstallation(body);

  const person = await prisma.person.findFirstOrThrow();

  expect(person.passwordHash.startsWith('$argon2id$')).toBe(true);
  expect(person.passwordHash).not.toContain(String(body.password));
  expect(await verify(person.passwordHash, String(body.password))).toBe(true);
});

test('stores the email trimmed and in lowercase', async () => {
  await postInstallation(validBody({ email: '  MARIA@Exemplo.ORG  ' }));

  const person = await prisma.person.findFirstOrThrow();

  expect(person.email).toBe('maria@exemplo.org');
});

test('sets the folioteca_session cookie with HttpOnly, SameSite=Lax and Path=/', async () => {
  const response = await postInstallation(validBody());

  const sessionCookie = findSessionCookie(response.headers);

  expect(sessionCookie).toContain('HttpOnly');
  expect(sessionCookie).toContain('SameSite=Lax');
  expect(sessionCookie).toContain('Path=/');
  expect(sessionCookie).not.toContain('Secure');
});

test('stores only the sha256 of the session token', async () => {
  const response = await postInstallation(validBody());

  const token = getSessionToken(findSessionCookie(response.headers));
  const session = await prisma.session.findFirstOrThrow();

  expect(token).not.toBe('');
  expect(session.tokenHash).toBe(
    createHash('sha256').update(token).digest('hex'),
  );
  expect(session.tokenHash).not.toContain(token);
  expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
});

test('GET /api/installation returns installed true after installing', async () => {
  await postInstallation(validBody());

  const response = await httpRequest(app).get('/api/installation');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: { installed: true } });
});

test('returns 403 with the generic message when the code is wrong', async () => {
  const response = await postInstallation(
    validBody({ code: randomBytes(24).toString('base64url') }),
  );

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: REFUSED_MESSAGE });
  expect(await prisma.organization.count()).toBe(0);
});

test('returns 403 with the same message when the code is missing from the body', async () => {
  const body = validBody();
  delete body.code;

  const response = await postInstallation(body);

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: REFUSED_MESSAGE });
});

test('returns 403 with the same message when INSTALL_CODE is not configured', async () => {
  // O serviço avisa no log que a instalação está bloqueada; o espião evita
  // que o aviso apareça na saída dos testes.
  const logWarn = vi
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => {});

  // O Nest não troca um provider `useValue` por `undefined` (a instância já
  // está resolvida), então o serviço real é montado com o código ausente.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(InstallationService)
    .useFactory({
      factory: (
        prismaService: PrismaService,
        passwords: PasswordService,
        sessions: SessionService,
      ) =>
        new InstallationService(prismaService, passwords, sessions, undefined),
      inject: [PrismaService, PasswordService, SessionService],
    })
    .compile();

  let appWithoutCode: INestApplication | undefined;

  try {
    appWithoutCode = await createApp({ module: moduleRef });

    const response = await httpRequest(appWithoutCode)
      .post('/api/installation')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(validBody());

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: REFUSED_MESSAGE });
    expect(logWarn).toHaveBeenCalled();
  } finally {
    await appWithoutCode?.close();
    logWarn.mockRestore();
  }
});

test('returns 403 and not 400 when the code is wrong and the fields are invalid', async () => {
  const response = await postInstallation(
    validBody({
      code: randomBytes(24).toString('base64url'),
      organizationName: '',
      email: 'nao-e-email',
      password: 'x'.repeat(11),
    }),
  );

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: REFUSED_MESSAGE });
});

test.each([
  {
    field: 'organizationName',
    overrides: { organizationName: '   ' },
    message: 'Informe o nome da organização.',
  },
  {
    field: 'name',
    overrides: { name: '' },
    message: 'Informe o seu nome.',
  },
  {
    field: 'email',
    overrides: { email: 'nao-e-email' },
    message: 'Informe um e-mail válido.',
  },
  {
    field: 'password',
    overrides: { password: 'x'.repeat(11) },
    message: 'A senha precisa ter pelo menos 12 caracteres.',
  },
  {
    field: 'password',
    overrides: { password: 'x'.repeat(129) },
    message: 'A senha pode ter no máximo 128 caracteres.',
  },
])(
  'returns 400 with Dados inválidos and one error per invalid field ($field: $message)',
  async ({ field, overrides, message }) => {
    const response = await postInstallation(validBody(overrides));

    const body = response.body as {
      message: string;
      errors: Array<{ field: string; message: string }>;
    };

    expect(response.status).toBe(400);
    expect(body.message).toBe('Dados inválidos.');
    expect(body.errors).toEqual([{ field, message }]);
  },
);

test('creates nothing when validation fails', async () => {
  const response = await postInstallation(validBody({ email: 'nao-e-email' }));

  expect(response.status).toBe(400);
  expect(await prisma.organization.count()).toBe(0);
  expect(await prisma.orgUnit.count()).toBe(0);
  expect(await prisma.person.count()).toBe(0);
  expect(await prisma.space.count()).toBe(0);
  expect(await prisma.session.count()).toBe(0);
});

test('returns 409 when the instance is already installed', async () => {
  await postInstallation(validBody());

  const response = await postInstallation(
    validBody({ email: 'joao@exemplo.org' }),
  );

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ message: 'Esta instância já foi instalada.' });
});

test('two simultaneous installations end as one 201 and one 409 with a single row in each table', async () => {
  const [first, second] = await Promise.all([
    postInstallation(validBody({ email: 'maria@exemplo.org' })),
    postInstallation(validBody({ email: 'joao@exemplo.org' })),
  ]);

  const statuses = [first.status, second.status].sort((a, b) => a - b);

  expect(statuses).toEqual([201, 409]);
  expect(await prisma.organization.count()).toBe(1);
  expect(await prisma.orgUnit.count()).toBe(1);
  expect(await prisma.person.count()).toBe(1);
  expect(await prisma.session.count()).toBe(1);
  expect(await prisma.space.count()).toBe(2);
});

test('returns 403 Requisição recusada without the X-Requested-With header', async () => {
  const response = await httpRequest(app)
    .post('/api/installation')
    .send(validBody());

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
  expect(await prisma.organization.count()).toBe(0);
});
