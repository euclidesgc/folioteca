import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type { CurrentUserResponse, LoginBody } from '@/types/api';

import { clearSignedInPerson, getDb, getSignedInPerson } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type FieldError = { field: string; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lightweight mirror of the real login schema, with the same pt_BR messages.
const validate = (body: Partial<LoginBody>): FieldError[] => {
  const errors: FieldError[] = [];

  if (!body.email?.trim()) {
    errors.push({ field: 'email', message: 'Informe o e-mail.' });
  } else if (!EMAIL_PATTERN.test(body.email.trim())) {
    errors.push({ field: 'email', message: 'Informe um e-mail válido.' });
  }

  if (!body.password) {
    errors.push({ field: 'password', message: 'Informe a senha.' });
  } else if (body.password.length > 128) {
    errors.push({
      field: 'password',
      message: 'A senha pode ter no máximo 128 caracteres.',
    });
  }

  return errors;
};

export const authHandlers = [
  http.get(`${env.API_URL}/auth/me`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('auth');
    if (forced) return forced;

    const { installation } = getDb();
    const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
    // Not always the installed person: accepting an invitation signs the new
    // person in.
    const person = getSignedInPerson();

    if (!installation || !hasSession || !person) {
      return HttpResponse.json(
        { message: 'Sessão não encontrada.' },
        { status: 401 },
      );
    }

    const body: CurrentUserResponse = {
      data: {
        person: { ...person, documentPageWidth: 'medium' },
        organization: installation.organization,
      },
    };
    return HttpResponse.json(body);
  }),

  http.post(`${env.API_URL}/auth/login`, async ({ request }) => {
    await networkDelay();
    const forced = await devOverride('auth');
    if (forced) return forced;

    const requestBody = (await request.json()) as Partial<LoginBody>;

    const errors = validate(requestBody);
    if (errors.length > 0) {
      return HttpResponse.json(
        { message: 'Dados inválidos.', errors },
        { status: 400 },
      );
    }

    const { installation } = getDb();
    const email = requestBody.email?.trim().toLowerCase();

    // The same answer for "no instance", "unknown e-mail" and "wrong
    // password": nothing here tells one case from another.
    if (
      !installation ||
      email !== installation.person.email ||
      requestBody.password !== installation.password
    ) {
      return HttpResponse.json(
        { message: 'E-mail ou senha incorretos.' },
        { status: 401 },
      );
    }

    // Session written straight to `document.cookie`, like the installation
    // handler does: MSW's own `Set-Cookie` store survives
    // `server.resetHandlers()` and leaks a signed-in session between tests.
    document.cookie = `${SESSION_COOKIE_NAME}=mock-session-token; path=/`;

    const body: CurrentUserResponse = {
      data: {
        // Same source as GET /auth/me: who the session belongs to.
        person: {
          ...(getSignedInPerson() ?? installation.person),
          documentPageWidth: 'medium',
        },
        organization: installation.organization,
      },
    };
    return HttpResponse.json(body);
  }),

  http.post(`${env.API_URL}/auth/logout`, async () => {
    await networkDelay();
    const forced = await devOverride('auth');
    if (forced) return forced;

    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    clearSignedInPerson();

    return new HttpResponse(null, { status: 204 });
  }),
];
