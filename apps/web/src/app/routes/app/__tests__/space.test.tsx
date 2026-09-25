import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { http } from 'msw';
import { beforeEach, expect, onTestFinished, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { resetLocalCollaboration } from '@/features/documents/utils/local-collaboration-provider';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  addFreeSpace,
  getDb,
  seedFreeSpaceMembership,
  seedFreeSpaceViewer,
  seedInstalled,
  seedSampleOrgUnits,
  seedSpaceMembers,
  seedUnitSpaceDocuments,
  setOrgUnitSpaceAccess,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { Component as SpaceRoute } from '../space';

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

  // The members of the unit come in a second list below the documents one:
  // the documents list is the one holding the document link.
  const documentLink = await content.findByRole(
    'link',
    { name: 'Manual de catalogação de periódicos' },
    LAZY_TIMEOUT,
  );
  const list = documentLink.closest('ul');
  expect(list).not.toBeNull();
  expect(
    within(list as HTMLElement).getByRole('link', {
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

test('the space page does not request GET spaces', async () => {
  seedSpaceMembers();
  const listRequests: string[] = [];
  const countListRequests = ({ request }: { request: Request }): void => {
    const path = new URL(request.url).pathname;
    if (
      request.method === 'GET' &&
      path === new URL(`${env.API_URL}/spaces`, 'http://x').pathname
    ) {
      listRequests.push(path);
    }
  };
  server.events.on('request:start', countListRequests);

  // Only the route: the sidebar, which lists the spaces, is not rendered.
  renderApp(<SpaceRoute />, {
    url: paths.space.getHref(CATALOGACAO_SPACE_ID),
    path: paths.space.path,
  });

  await screen.findByRole(
    'heading',
    { level: 1, name: 'Catalogação' },
    LAZY_TIMEOUT,
  );
  await screen.findByRole(
    'list',
    { name: 'Pessoas nesta unidade' },
    LAZY_TIMEOUT,
  );
  server.events.removeListener('request:start', countListRequests);

  expect(listRequests).toHaveLength(0);
});

test('the unit space page shows the members section', async () => {
  seedSpaceMembers();

  renderRoutes(paths.space.getHref(CATALOGACAO_SPACE_ID));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Catalogação' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  expect(
    content.getByRole('heading', { level: 2, name: 'Pessoas nesta unidade' }),
  ).toBeInTheDocument();
  const list = await content.findByRole(
    'list',
    { name: 'Pessoas nesta unidade' },
    LAZY_TIMEOUT,
  );
  const items = within(list).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Ana Souza');
  expect(items[0]).toHaveTextContent('você');
  expect(items[1]).toHaveTextContent('Marta Ribeiro');
});

test('the free space page shows the space documents list and Novo documento to its owner', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderRoutes(paths.space.getHref(space.id));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  expect(
    await content.findByText(
      'Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  const newDocument = content.getByRole('button', { name: 'Novo documento' });
  const membersHeading = content.getByRole('heading', {
    level: 2,
    name: 'Pessoas neste espaço',
  });
  expect(
    newDocument.compareDocumentPosition(membersHeading) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    content.queryByText(/Os documentos deste espaço ainda não chegaram/),
  ).not.toBeInTheDocument();
});

test('the free space page shows the owner document to a member', async () => {
  seedFreeSpaceMembership();
  const space = getDb().spaces.find(
    (item) => item.type === 'free' && item.name === 'Clube de leitura',
  );
  expect(space).toBeDefined();
  const spaceId = space?.id ?? '';

  renderRoutes(paths.space.getHref(spaceId));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Clube de leitura' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  expect(
    screen.getByText('Um espaço livre de que você é membro.'),
  ).toBeInTheDocument();
  expect(
    await content.findByRole(
      'link',
      { name: 'Ata da primeira reunião' },
      LAZY_TIMEOUT,
    ),
  ).toHaveAttribute(
    'href',
    paths.document.getHref('document-free-space-owner'),
  );
  expect(
    content.getByRole('button', { name: 'Novo documento' }),
  ).toBeInTheDocument();
  expect(
    content.queryByRole('button', { name: 'Adicionar pessoa' }),
  ).not.toBeInTheDocument();
});

test('passes canCreateDocuments false to the documents and hides Novo documento', async () => {
  seedFreeSpaceViewer();
  const space = getDb().spaces.find(
    (item) => item.type === 'free' && item.name === 'Clube de leitura',
  );
  expect(space).toBeDefined();
  const spaceId = space?.id ?? '';

  renderRoutes(paths.space.getHref(spaceId));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Clube de leitura' },
    LAZY_TIMEOUT,
  );
  const main = heading.closest('main');
  expect(main).not.toBeNull();
  const content = within(main as HTMLElement);

  expect(
    await content.findByRole(
      'link',
      { name: 'Ata da primeira reunião' },
      LAZY_TIMEOUT,
    ),
  ).toHaveAttribute(
    'href',
    paths.document.getHref('document-free-space-viewer'),
  );
  expect(
    content.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();
  expect(
    content.queryByRole('button', { name: 'Adicionar pessoa' }),
  ).not.toBeInTheDocument();
});

test(
  'creating a document in a free space sends the spaceId and navigates to it',
  { timeout: 20_000 },
  async () => {
    const user = userEvent.setup();
    const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
    let postedBody: unknown = null;
    // Reads the body and returns nothing: the request falls through to the
    // handler of the fake database, which creates the document.
    server.use(
      http.post(`${env.API_URL}/documents`, async ({ request }) => {
        postedBody = await request.clone().json();
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: queryConfig });
    const router = createMemoryRouter(createRoutes(), {
      initialEntries: [paths.space.getHref(space.id)],
    });
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const heading = await screen.findByRole(
      'heading',
      { level: 1, name: 'Comissão de Leitura' },
      LAZY_TIMEOUT,
    );
    const content = within(heading.closest('main') as HTMLElement);
    await user.click(
      await content.findByRole(
        'button',
        { name: 'Novo documento' },
        LAZY_TIMEOUT,
      ),
    );

    expect(
      await screen.findByRole(
        'textbox',
        { name: 'Título do documento' },
        LAZY_TIMEOUT,
      ),
    ).toHaveValue('documento-sem-titulo-1');
    expect(postedBody).toEqual({ spaceId: space.id });
    const created = getDb().documents.find(
      (document) => document.spaceId === space.id,
    );
    expect(created).toBeDefined();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        paths.document.getHref(created?.id ?? ''),
      );
    }, LAZY_TIMEOUT);
  },
);

test('a new document in the space appears as documento-sem-titulo-1', { timeout: 20_000 }, async () => {
  const user = userEvent.setup();
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  // The journey stays on the document page long enough to open the
  // collaboration session: the in-memory provider of the simulated API
  // stands in for the WebSocket, only in this case.
  const wasMocking = env.ENABLE_API_MOCKING;
  env.ENABLE_API_MOCKING = true;
  onTestFinished(() => {
    env.ENABLE_API_MOCKING = wasMocking;
    resetLocalCollaboration();
  });

  renderRoutes(paths.space.getHref(space.id));

  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  const content = within(heading.closest('main') as HTMLElement);
  await user.click(
    await content.findByRole(
      'button',
      { name: 'Novo documento' },
      LAZY_TIMEOUT,
    ),
  );

  expect(
    await screen.findByRole(
      'textbox',
      { name: 'Título do documento' },
      LAZY_TIMEOUT,
    ),
  ).toHaveValue('documento-sem-titulo-1');

  const nav = screen.getByRole('navigation', { name: 'Espaços' });
  await user.click(
    within(nav).getByRole('link', { name: 'Comissão de Leitura' }),
  );

  const spaceHeading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  expect(
    await within(spaceHeading.closest('main') as HTMLElement).findByRole(
      'link',
      { name: 'documento-sem-titulo-1' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});
