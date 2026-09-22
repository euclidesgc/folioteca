import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  getDb,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { screen, within } from '@/testing/test-utils';

// The route is `lazy` and sits past the gate: every wait of this file gets
// the same explicit budget.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const CATALOGACAO_SPACE_ID = 'space-org-unit-catalogacao';
// Exists in the fake database, but nobody assigned the person to it.
const RESTAURO_SPACE_ID = 'space-org-unit-restauro';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
  addAssignment('org-unit-sala-infantil', INSTALLED_PERSON_ID);
});

const renderRoutes = (url: string): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

test('an assigned person opens the space by URL and sees the unit name', async () => {
  renderRoutes(paths.unitSpace.getHref(CATALOGACAO_SPACE_ID));

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('O espaço de documentos da sua unidade.'),
  ).toBeInTheDocument();
});

test('an unknown id and a space the person is not assigned to render the same not found state', async () => {
  expect(
    getDb().spaces.some((space) => space.id === RESTAURO_SPACE_ID),
  ).toBe(true);
  expect(
    getDb().assignments.some(
      (item) =>
        item.orgUnitId === 'org-unit-restauro' &&
        item.personId === INSTALLED_PERSON_ID,
    ),
  ).toBe(false);

  const unknown = renderRoutes(paths.unitSpace.getHref('space-que-nao-existe'));
  const unknownAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  const unknownMain = unknownAlert.closest('main');
  const unknownContent = unknownMain?.innerHTML;
  expect(unknownAlert).toHaveTextContent('Espaço não encontrado.');
  unknown.unmount();

  renderRoutes(paths.unitSpace.getHref(RESTAURO_SPACE_ID));
  const notAssignedAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(notAssignedAlert).toHaveTextContent('Espaço não encontrado.');

  expect(unknownContent).toBeDefined();
  expect(notAssignedAlert.closest('main')?.innerHTML).toBe(unknownContent);
});

test('the Unidades section shows the open space as active', async () => {
  renderRoutes(paths.unitSpace.getHref(CATALOGACAO_SPACE_ID));

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Unidades' },
    LAZY_TIMEOUT,
  );
  await screen.findByRole(
    'heading',
    { level: 1, name: 'Catalogação' },
    LAZY_TIMEOUT,
  );

  expect(
    within(nav).getByRole('link', { name: 'Catalogação' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    within(nav).getByRole('link', { name: 'Sala Infantil' }),
  ).not.toHaveAttribute('aria-current');
});
