import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import {
  acceptInvitation,
  addInvitation,
  getDb,
  type MockInvitation,
  pageWidthOf,
  revokeInvitation,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

// The envelopes of the contract: `types/api.ts` is untouched in this slice, so
// the aliases live where they are used.
type CreatedInvitationResponse =
  components['schemas']['CreatedInvitationResponse'];
type InvitationsResponse = components['schemas']['InvitationsResponse'];
type InvitationPreviewResponse =
  components['schemas']['InvitationPreviewResponse'];
type CurrentUserResponse = components['schemas']['CurrentUserResponse'];

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

// The single 404 of the two public routes, for the same reason the server has
// a single one: an unknown, an expired and an already accepted link answer
// exactly the same, so nothing tells the cases apart. The message is not the
// API literal on purpose — no screen of this app ever echoes it.
const invitationUnavailable = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Convite indisponível.' }, { status: 404 });

// What "pending" means, the same three rules the server applies: not accepted,
// not revoked and not expired yet. Because `findAvailableInvitation` below
// reads this predicate, a revoked link stops opening on both public routes
// without a single new line in them.
const isPending = (invitation: MockInvitation): boolean =>
  invitation.acceptedAt === null &&
  invitation.revokedAt === null &&
  new Date(invitation.expiresAt).getTime() > Date.now();

// The invitation a public route may answer about: the refusals of the server,
// all in one place. It keeps answering `undefined` for a refused link, which
// is the contract of the public 404, and is never used as the list filter.
const findAvailableInvitation = (token: string): MockInvitation | undefined => {
  const invitation = getDb().invitations.find((item) => item.token === token);
  if (!invitation) return undefined;
  if (!isPending(invitation)) return undefined;

  return invitation;
};

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
  // Declared before the `/invitations/:token` handlers below: the two paths do
  // not collide, and the order makes the reading obvious.
  http.get(`${env.API_URL}/invitations`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('invitations');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, invitations } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    const body: InvitationsResponse = {
      data: [...invitations]
        .filter(isPending)
        // Newest first, over a copy of the array: sorting the state itself
        // would reorder the fake database behind every other handler.
        .sort(
          (first, second) =>
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime(),
        )
        // Assembled field by field, never with `...invitation`: that is what
        // keeps the token (kept in the clear in this fake database) from
        // leaking into the body by accident.
        .map((invitation) => ({
          id: invitation.id,
          email: invitation.email,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
        })),
    };
    return HttpResponse.json(body);
  }),

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

    const invitation = addInvitation({ email: normalized });
    const body: CreatedInvitationResponse = {
      data: {
        id: invitation.id,
        email: invitation.email,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        // Shown a single time here, as the real API does; from slice 086 on it
        // is also what the public routes below look the invitation up by.
        token: invitation.token,
      },
    };
    return HttpResponse.json(body, { status: 201 });
  }),

  // Declared after the `POST /invitations` above and before the
  // `/invitations/:token` handlers below: `:invitationId/revoke` collides with
  // neither, and the order makes the reading obvious.
  http.post(
    `${env.API_URL}/invitations/:invitationId/revoke`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('invitations');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { installation } = getDb();
      if (!installation) return unauthenticated();
      if (!installation.person.isAdmin) return forbidden();

      // An unknown id and an invitation that is not pending any more answer
      // exactly the same, as the server does: nothing here tells the cases
      // apart.
      const revoked = revokeInvitation(String(params.invitationId));
      if (!revoked) return invitationUnavailable();

      return new HttpResponse(null, { status: 204 });
    },
  ),

  // Public: the invitation is opened by someone who has no account yet, so no
  // cookie is read here.
  http.get(`${env.API_URL}/invitations/:token`, async ({ params }) => {
    await networkDelay();
    const forced = await devOverride('invitations');
    if (forced) return forced;

    const { installation } = getDb();
    const invitation = findAvailableInvitation(String(params.token));
    if (!installation || !invitation) return invitationUnavailable();

    const body: InvitationPreviewResponse = {
      data: {
        email: invitation.email,
        organizationName: installation.organization.name,
      },
    };
    return HttpResponse.json(body);
  }),

  // Public as well: accepting the invitation is what creates the account. The
  // order of the refusals mirrors the server: body, then invitation, then the
  // e-mail that already belongs to a person.
  http.post(
    `${env.API_URL}/invitations/:token/accept`,
    async ({ request, params }) => {
      await networkDelay();
      const forced = await devOverride('invitations');
      if (forced) return forced;

      const requestBody = (await request.json()) as Record<string, unknown>;

      const refused = unknownKey(requestBody, ['name', 'password']);
      if (refused) return invalid(refused, 'Campo não permitido.');

      const { name, password } = requestBody;
      if (typeof name !== 'string' || name.trim().length === 0) {
        return invalid('name', 'Informe o seu nome.');
      }
      if (name.trim().length > 120) {
        return invalid('name', 'O nome pode ter no máximo 120 caracteres.');
      }
      if (typeof password !== 'string' || password.length < 12) {
        return invalid(
          'password',
          'A senha precisa ter pelo menos 12 caracteres.',
        );
      }
      if (password.length > 128) {
        return invalid('password', 'A senha pode ter no máximo 128 caracteres.');
      }

      const token = String(params.token);
      const { installation, people } = getDb();
      const invitation = findAvailableInvitation(token);
      if (!installation || !invitation) return invitationUnavailable();

      const invited = normalizeEmail(invitation.email);
      const isAlreadyAPerson =
        invited === normalizeEmail(installation.person.email) ||
        people.some((person) => normalizeEmail(person.email) === invited);
      if (isAlreadyAPerson) return conflict();

      const person = acceptInvitation({ token, name: name.trim() });

      // Session written straight to `document.cookie`, like the login handler
      // does, for the reason documented there.
      document.cookie = `${SESSION_COOKIE_NAME}=mock-session-token; path=/`;

      const body: CurrentUserResponse = {
        data: {
          person: { ...person, documentPageWidth: pageWidthOf(person) },
          organization: installation.organization,
        },
      };
      return HttpResponse.json(body, { status: 201 });
    },
  ),
];
