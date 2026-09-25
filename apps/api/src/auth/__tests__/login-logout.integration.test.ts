import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../password.service';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const SESSION_COOKIE_PREFIX = 'folioteca_session=';

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos.';

const EMAIL = 'maria@exemplo.org';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

let app: INestApplication;
let prisma: PrismaService;

type ValidationErrorBody = {
  message: string;
  errors: Array<{ field: string; message: string }>;
};

function findSessionCookie(headers: Record<string, unknown>): string {
  const cookies = (headers['set-cookie'] ?? []) as string[];
  const cookie = cookies.find((item) => item.startsWith(SESSION_COOKIE_PREFIX));

  if (cookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return cookie;
}

function findSessionCookieOrUndefined(
  headers: Record<string, unknown>,
): string | undefined {
  const cookies = (headers['set-cookie'] ?? []) as string[];

  return cookies.find((item) => item.startsWith(SESSION_COOKIE_PREFIX));
}

/** Só o par `nome=valor` do cabeçalho, para reenviar como `Cookie`. */
function toCookiePair(setCookie: string): string {
  return setCookie.split(';')[0] ?? '';
}

/** Instala a instância e devolve as credenciais e o cookie da sessão criada. */
async function install(): Promise<{ password: string; cookie: string }> {
  const password = randomUUID();

  const response = await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: EMAIL,
      password,
    });

  expect(response.status).toBe(201);

  return {
    password,
    cookie: toCookiePair(findSessionCookie(response.headers)),
  };
}

function postLogin(
  body: Record<string, unknown>,
): ReturnType<ReturnType<typeof httpRequest>['post']> {
  return httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
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

test('POST /api/auth/login returns 200 with the same body as GET /api/auth/me', async () => {
  const { password, cookie } = await install();

  const login = await postLogin({ email: EMAIL, password });
  const me = await httpRequest(app).get('/api/auth/me').set('Cookie', cookie);

  expect(login.status).toBe(200);
  expect(login.body).toEqual({
    data: {
      person: {
        id: ANY_STRING,
        name: 'Maria Souza',
        email: EMAIL,
        isAdmin: true,
        documentPageWidth: 'medium',
      },
      organization: {
        id: ANY_STRING,
        name: 'Prefeitura de Exemplo',
      },
    },
  });
  expect(login.body).toEqual(me.body);
});

test('sets the folioteca_session cookie with HttpOnly, SameSite=Lax and Path=/', async () => {
  const { password } = await install();

  const response = await postLogin({ email: EMAIL, password });

  const sessionCookie = findSessionCookie(response.headers);

  expect(sessionCookie).toContain('HttpOnly');
  expect(sessionCookie).toContain('SameSite=Lax');
  expect(sessionCookie).toContain('Path=/');
  expect(sessionCookie).not.toContain('Secure');
});

test('the login cookie opens GET /api/auth/me', async () => {
  const { password } = await install();

  const login = await postLogin({ email: EMAIL, password });
  const cookie = toCookiePair(findSessionCookie(login.headers));

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual(login.body);
});

test('accepts the email in a different case and with surrounding spaces', async () => {
  const { password } = await install();

  const response = await postLogin({
    email: '  MARIA@Exemplo.ORG  ',
    password,
  });

  expect(response.status).toBe(200);
  expect(findSessionCookieOrUndefined(response.headers)).toBeDefined();
});

test('returns 401 E-mail ou senha incorretos. for a wrong password', async () => {
  await install();

  const response = await postLogin({ email: EMAIL, password: randomUUID() });

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: INVALID_CREDENTIALS_MESSAGE });
});

test('returns the same status and the same body for an unknown email', async () => {
  const { password } = await install();

  const wrongPassword = await postLogin({
    email: EMAIL,
    password: randomUUID(),
  });
  const unknownEmail = await postLogin({
    email: 'joao@exemplo.org',
    password,
  });

  expect(unknownEmail.status).toBe(wrongPassword.status);
  expect(unknownEmail.body).toEqual(wrongPassword.body);
  expect(unknownEmail.body).toEqual({ message: INVALID_CREDENTIALS_MESSAGE });
});

test('verifies one argon2 hash even when the email does not exist', async () => {
  await install();

  const verifySpy = vi.spyOn(PasswordService.prototype, 'verify');

  try {
    const response = await postLogin({
      email: 'joao@exemplo.org',
      password: randomUUID(),
    });

    expect(response.status).toBe(401);
    expect(verifySpy).toHaveBeenCalledTimes(1);
  } finally {
    verifySpy.mockRestore();
  }
});

test('never returns passwordHash', async () => {
  const { password } = await install();

  const response = await postLogin({ email: EMAIL, password });

  expect(response.text).not.toContain('passwordHash');
  expect(response.text).not.toContain('$argon2id$');
});

test.each([
  {
    field: 'email',
    overrides: { email: '' },
    message: 'Informe o e-mail.',
  },
  {
    field: 'email',
    overrides: { email: 'nao-e-email' },
    message: 'Informe um e-mail válido.',
  },
  {
    field: 'password',
    overrides: { password: '' },
    message: 'Informe a senha.',
  },
  {
    field: 'password',
    overrides: { password: 'x'.repeat(129) },
    message: 'A senha pode ter no máximo 128 caracteres.',
  },
])(
  'returns 400 with Dados inválidos and one error per invalid field ($field: $message)',
  async ({ field, overrides, message }) => {
    const { password } = await install();

    const response = await postLogin({
      email: EMAIL,
      password,
      ...overrides,
    });

    const body = response.body as ValidationErrorBody;

    expect(response.status).toBe(400);
    expect(body.message).toBe('Dados inválidos.');
    expect(body.errors).toEqual([{ field, message }]);
  },
);

test('does not set a cookie when the login fails', async () => {
  await install();

  const response = await postLogin({ email: EMAIL, password: randomUUID() });

  expect(response.status).toBe(401);
  expect(findSessionCookieOrUndefined(response.headers)).toBeUndefined();
});

test('returns 403 Requisição recusada. without the X-Requested-With header', async () => {
  const { password } = await install();

  const response = await httpRequest(app)
    .post('/api/auth/login')
    .send({ email: EMAIL, password });

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
  expect(findSessionCookieOrUndefined(response.headers)).toBeUndefined();
});

test('logging in with an old session cookie revokes the old session', async () => {
  const { password, cookie: oldCookie } = await install();

  const login = await postLogin({ email: EMAIL, password }).set(
    'Cookie',
    oldCookie,
  );

  const withOldCookie = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', oldCookie);

  expect(login.status).toBe(200);
  expect(withOldCookie.status).toBe(401);
  expect(await prisma.session.count()).toBe(1);
});

test('POST /api/auth/logout returns 204, deletes the session row and clears the cookie', async () => {
  const { cookie } = await install();

  const response = await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);

  const clearedCookie = findSessionCookie(response.headers);

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(clearedCookie).toContain(`${SESSION_COOKIE_PREFIX};`);
  expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  expect(await prisma.session.count()).toBe(0);
});

test('the same cookie gets 401 on GET /api/auth/me after logout', async () => {
  const { cookie } = await install();

  await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', cookie);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

test('logout without a cookie returns 204', async () => {
  await install();

  const response = await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest');

  expect(response.status).toBe(204);
  expect(await prisma.session.count()).toBe(1);
});

test('a repeated logout returns 204', async () => {
  const { cookie } = await install();

  const first = await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);

  const second = await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);

  expect(first.status).toBe(204);
  expect(second.status).toBe(204);
  expect(await prisma.session.count()).toBe(0);
});

test('logout returns 403 without the X-Requested-With header', async () => {
  const { cookie } = await install();

  const response = await httpRequest(app)
    .post('/api/auth/logout')
    .set('Cookie', cookie);

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
  expect(await prisma.session.count()).toBe(1);
});
