import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type { HealthResponse } from '@/types/api';

import { devOverride, networkDelay } from '../utils';

export const healthHandlers = [
  http.get(`${env.API_URL}/health`, async () => {
    await networkDelay();
    const forced = await devOverride('health');
    if (forced) return forced;

    const body: HealthResponse = {
      data: { status: 'ok', database: 'up', commit: 'test-commit' },
    };
    return HttpResponse.json(body);
  }),
];
