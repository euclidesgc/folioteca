import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import { addInvitation, getDb, nextInvitationToken } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

// The envelope of the 201, straight from the contract: `types/api.ts` is
// untouched in this slice, so the alias lives where it is used.
type CreatedInvitationResponse =
  components['schemas']['CreatedInvitationResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

const conflict = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Esta pessoa já faz parte da organização.' },
    { status: 409 },
  );

const invalid = (
  field: string,
  message: string,
): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Dados inválidos.', errors: [{ field, message }] },
    { status: 400 },
  );

// The API rejects the body with a strict schema: any key it does not know is
// refused.
const unknownKey = (
  body: Record<string, unknown>,
  allowed: string[],
): string | undefined =>
  Object.keys(body).find((key) => !allowed.includes(key));

// Enough to tell "ana@exemplo.com.br" from "nao-e-um-email": the real
// validation is `z.email` on both sides.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same treatment the API gives the e-mail, and the reason the 409 below can
// compare it with the person's: trimmed and lowercased before anything else.
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const invitationsHandlers = [
  http.post(`${env.API_URL}/invitations`, async ({ request, cookies }) => {
    await networkDelay();
    const forced = await devOverride('invitations');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    const requestBody = (await request.json()) as Record<string, unknown>;

    const refused = unknownKey(requestBody, ['email']);
    if (refused) return invalid(refused, 'Campo não permitido.');

    const { email } = requestBody;
    if (typeof email !== 'string' || normalizeEmail(email).length === 0) {
      return invalid('email', 'Informe o e-mail.');
    }

    const normalized = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalized)) {
      return invalid('email', 'Informe um e-mail válido.');
    }

    if (normalized === normalizeEmail(installation.person.email)) {
      return conflict();
    }

    const body: CreatedInvitationResponse = {
      data: {
        ...addInvitation({ email: normalized }),
        // The only place the token exists: assembled now, never stored.
        token: nextInvitationToken(),
      },
    };
    return HttpResponse.json(body, { status: 201 });
  }),
];
