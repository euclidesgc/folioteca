import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { createOrgUnit } from '@/features/org-units/api/create-org-unit';
import { getOrgUnits } from '@/features/org-units/api/get-org-units';
import { updateOrgUnit } from '@/features/org-units/api/update-org-unit';
import { queryConfig } from '@/lib/react-query';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor } from '@/testing/test-utils';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

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

test('an admin opens /admin/structure and sees the heading and the tree', async () => {
  seedSampleOrgUnits();

  renderRoutes(paths.admin.structure.getHref());

  const headings = await screen.findAllByRole(
    'heading',
    { level: 1 },
    LAZY_TIMEOUT,
  );
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Estrutura');
  expect(
    screen.getByText('As unidades da organização, da raiz até as equipes.'),
  ).toBeInTheDocument();

  expect(
    await screen.findByRole(
      'tree',
      { name: 'Estrutura de unidades' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('an admin reaches the page from the Administração link in the sidebar', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  const router = renderRoutes(paths.home.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Administração' },
    LAZY_TIMEOUT,
  );

  await user.click(
    await screen.findByRole('link', { name: 'Estrutura' }, LAZY_TIMEOUT),
  );

  expect(nav).toBeInTheDocument();
  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Estrutura' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () =>
      expect(router.state.location.pathname).toBe(
        paths.admin.structure.path,
      ),
    LAZY_TIMEOUT,
  );
});

test('a person who is not admin lands on home and no request to org-units is made', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });
  seedSampleOrgUnits();

  let orgUnitsCalls = 0;
  server.use(
    http.get(`${env.API_URL}/org-units`, () => {
      orgUnitsCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
  );

  const router = renderRoutes(paths.admin.structure.getHref());

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

  expect(
    screen.queryByRole('heading', { level: 1, name: 'Estrutura' }),
  ).not.toBeInTheDocument();
  expect(orgUnitsCalls).toBe(0);
});

test('a person who is not admin does not see Administração in the sidebar', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  renderRoutes(paths.home.getHref());

  await screen.findByRole(
    'heading',
    { level: 1, name: 'Boas-vindas à Folioteca' },
    LAZY_TIMEOUT,
  );

  expect(
    screen.queryByRole('navigation', { name: 'Administração' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Estrutura' }),
  ).not.toBeInTheDocument();
});

test('the fetcher called directly by a person who is not admin gets 403 from the default handler', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  await expect(getOrgUnits()).rejects.toMatchObject({
    response: { status: 403 },
  });
});

test('renaming the root changes the organization name in the sidebar identity', async () => {
  const user = userEvent.setup();
  seedSampleOrgUnits();

  renderRoutes(paths.admin.structure.getHref());

  await screen.findByRole(
    'tree',
    { name: 'Estrutura de unidades' },
    LAZY_TIMEOUT,
  );
  expect(
    screen.getAllByTitle('Biblioteca Municipal de Exemplo').length,
  ).toBeGreaterThan(0);

  await user.click(
    screen.getByRole('button', {
      name: 'Renomear Biblioteca Municipal de Exemplo',
    }),
  );

  const dialog = await screen.findByRole('dialog', {
    name: 'Renomear unidade',
  });
  await user.clear(screen.getByLabelText('Nome'));
  await user.type(screen.getByLabelText('Nome'), 'Biblioteca Municipal Central');
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  const organizationName = await screen.findByText(
    'Biblioteca Municipal Central',
    { selector: 'dd' },
  );
  expect(organizationName).toBeInTheDocument();
  expect(
    screen.queryByText('Biblioteca Municipal de Exemplo', { selector: 'dd' }),
  ).not.toBeInTheDocument();
});

test('createOrgUnit called directly by a person who is not admin gets 403 from the default handler', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  await expect(
    createOrgUnit({
      parentId: ROOT_ORG_UNIT_ID,
      data: { name: 'Núcleo de Memória' },
    }),
  ).rejects.toMatchObject({ response: { status: 403 } });
});

test('updateOrgUnit called directly by a person who is not admin gets 403 from the default handler', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  await expect(
    updateOrgUnit({
      orgUnitId: ROOT_ORG_UNIT_ID,
      data: { name: 'Outro nome' },
    }),
  ).rejects.toMatchObject({ response: { status: 403 } });
});
