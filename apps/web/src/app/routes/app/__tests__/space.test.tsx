import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  addFreeSpace,
  getDb,
  seedInstalled,
  seedSampleOrgUnits,
  seedUnitSpaceDocuments,
  setOrgUnitSpaceAccess,
} from '@/testing/mocks/db';
import { screen, userEvent, within } from '@/testing/test-utils';

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
  renderRoutes(paths.space.getHref(CATALOGACAO_SPACE_ID));

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

  const unknown = renderRoutes(paths.space.getHref('space-que-nao-existe'));
  const unknownAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  const unknownMain = unknownAlert.closest('main');
  const unknownContent = unknownMain?.innerHTML;
  expect(unknownAlert).toHaveTextContent('Espaço não encontrado.');
  unknown.unmount();

  renderRoutes(paths.space.getHref(RESTAURO_SPACE_ID));
  const notAssignedAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(notAssignedAlert).toHaveTextContent('Espaço não encontrado.');

  expect(unknownContent).toBeDefined();
  expect(notAssignedAlert.closest('main')?.innerHTML).toBe(unknownContent);
});

test('the Unidades section shows the open space as active', async () => {
  renderRoutes(paths.space.getHref(CATALOGACAO_SPACE_ID));

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

test('creating a space from the sidebar opens its page with the name in the heading and the item in the section', async () => {
  const user = userEvent.setup();
  renderRoutes(paths.home.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Espaços' },
    LAZY_TIMEOUT,
  );
  await within(nav).findByText(
    'Você ainda não tem espaços.',
    {},
    LAZY_TIMEOUT,
  );
  await user.click(within(nav).getByRole('button', { name: 'Novo espaço' }));
  const dialog = await screen.findByRole(
    'dialog',
    { name: 'Novo espaço' },
    LAZY_TIMEOUT,
  );
  await user.type(within(dialog).getByLabelText('Nome'), 'Comissão de Leitura');
  await user.click(within(dialog).getByRole('button', { name: 'Criar espaço' }));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  expect(
    screen.getByText('Um espaço livre, de que você é dona.'),
  ).toBeInTheDocument();
  expect(heading.closest('main')).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    within(nav).getByRole('link', { name: 'Comissão de Leitura' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('a space of another owner and an unknown id render the same not found state', async () => {
  const otherOwners = addFreeSpace('person-2', 'Comissão de Outra Pessoa');
  expect(
    getDb().spaces.some((space) => space.id === otherOwners.id),
  ).toBe(true);

  const unknown = renderRoutes(paths.space.getHref('space-que-nao-existe'));
  const unknownAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  const unknownContent = unknownAlert.closest('main')?.innerHTML;
  expect(unknownAlert).toHaveTextContent('Espaço não encontrado.');
  unknown.unmount();

  renderRoutes(paths.space.getHref(otherOwners.id));
  const otherOwnerAlert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(otherOwnerAlert).toHaveTextContent('Espaço não encontrado.');
  expect(
    screen.queryByText('Comissão de Outra Pessoa'),
  ).not.toBeInTheDocument();

  expect(unknownContent).toBeDefined();
  expect(otherOwnerAlert.closest('main')?.innerHTML).toBe(unknownContent);
});

test('the unit space page shows the space documents list', async () => {
  seedUnitSpaceDocuments();

  renderRoutes(paths.space.getHref(CATALOGACAO_SPACE_ID));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Catalogação' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  const list = await content.findByRole('list', {}, LAZY_TIMEOUT);
  expect(
    within(list).getByRole('link', {
      name: 'Manual de catalogação de periódicos',
    }),
  ).toHaveAttribute(
    'href',
    paths.document.getHref('document-unit-space-colleague'),
  );
  expect(
    content.getByRole('button', { name: 'Novo documento' }),
  ).toBeInTheDocument();
});

test('the inherited unit space page shows the direct assignment notice', async () => {
  // Restauro inherits from Acervo, where the person is assigned: the page
  // opens, its documents do not.
  setOrgUnitSpaceAccess('org-unit-restauro', 'inherit');
  addAssignment('org-unit-acervo', INSTALLED_PERSON_ID);

  renderRoutes(paths.space.getHref(RESTAURO_SPACE_ID));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Restauro e Conservação' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  expect(
    await content.findByText(
      'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    content.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();
  expect(content.queryByRole('list')).not.toBeInTheDocument();
});
