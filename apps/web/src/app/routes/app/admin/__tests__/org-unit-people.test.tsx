import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, waitFor, within } from '@/testing/test-utils';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const UNIT_PEOPLE_PATH = `${env.API_URL}/org-units/:orgUnitId/people`;

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The real routes of the app, in a memory router.
const renderRoutes = (url: string): ReturnType<typeof createMemoryRouter> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

test('an admin opens the route by URL and sees the unit name in the h1', async () => {
  seedSampleOrgUnits();

  renderRoutes(paths.admin.orgUnitPeople.getHref('org-unit-catalogacao'));

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  // A single `h1` on the page, before and after the name arrives.
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(
    screen.getByText('As pessoas lotadas nesta unidade.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Voltar para a estrutura' }),
  ).toHaveAttribute('href', paths.admin.structure.getHref());
});

test('while loading the h1 reads Pessoas da unidade', async () => {
  server.use(
    http.get(UNIT_PEOPLE_PATH, async () => {
      await delay('infinite');
      return HttpResponse.json({
        data: [],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: 'Biblioteca Municipal de Exemplo' },
      });
    }),
  );

  renderRoutes(paths.admin.orgUnitPeople.getHref(ROOT_ORG_UNIT_ID));

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Pessoas da unidade' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  // The sidebar has a status of its own: the list is found by its own text.
  expect(
    await screen.findByText('Carregando as pessoas lotadas…', {}, LAZY_TIMEOUT),
  ).toHaveAttribute('role', 'status');
});

test('an unknown unit shows the not found alert with a link back to the structure', async () => {
  renderRoutes(paths.admin.orgUnitPeople.getHref('unidade-que-nao-existe'));

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Unidade não encontrada.');
  expect(
    within(alert).getByRole('link', { name: 'Voltar para a estrutura' }),
  ).toHaveAttribute('href', paths.admin.structure.getHref());
  expect(
    screen.queryByText('As pessoas lotadas nesta unidade.'),
  ).not.toBeInTheDocument();
});

test('a non-admin is sent home with no request', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });
  seedSampleOrgUnits();

  let unitPeopleCalls = 0;
  server.use(
    http.get(UNIT_PEOPLE_PATH, () => {
      unitPeopleCalls += 1;
      return HttpResponse.json({
        data: [],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: 'Biblioteca Municipal de Exemplo' },
      });
    }),
  );

  const router = renderRoutes(
    paths.admin.orgUnitPeople.getHref(ROOT_ORG_UNIT_ID),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(router.state.location.pathname).toBe(paths.home.path),
    LAZY_TIMEOUT,
  );
  expect(unitPeopleCalls).toBe(0);
});
