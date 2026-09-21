import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type { CurrentUserResponse } from '@/types/api';

import { getDb } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

export const authHandlers = [
  http.get(`${env.API_URL}/auth/me`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('auth');
    if (forced) return forced;

    const { installation } = getDb();
    const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);

    if (!installation || !hasSession) {
      return HttpResponse.json(
        { message: 'Sessão não encontrada.' },
        { status: 401 },
      );
    }

    const body: CurrentUserResponse = {
      data: {
        person: installation.person,
        organization: installation.organization,
      },
    };
    return HttpResponse.json(body);
  }),
];
