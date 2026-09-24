import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  createDocumentIn,
  seedInstalled,
  seedSampleOrgUnits,
  setOrgUnitSpaceAccess,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, within } from '@/testing/test-utils';

import { SpaceDocuments } from '../space-documents';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const CATALOGACAO_SPACE_ID = 'space-org-unit-catalogacao';
const EMPTY_MESSAGE =
  'Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.';
const DIRECT_ASSIGNMENT_NOTICE =
  'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
});

// Creating a document navigates: the memory router needs a real destination
// for the document address.
const renderSpaceDocuments = (
  spaceId: string = CATALOGACAO_SPACE_ID,
  canCreate = true,
) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <SpaceDocuments spaceId={spaceId} canCreate={canCreate} />,
      },
      { path: paths.document.path, element: <p>Página do documento</p> },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

test('shows the loading status without the new document button', async () => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/documents`, async () => {
      await released;
      return HttpResponse.json({ data: [] });
    }),
  );

  renderSpaceDocuments();

  expect(screen.getByRole('status')).toHaveTextContent(
    'Carregando documentos do espaço…',
  );
  expect(
    screen.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();

  release();

  expect(
    await screen.findByRole('button', { name: 'Novo documento' }, LAZY_TIMEOUT),
  ).toBeInTheDocument();
});

test('shows the empty message with the new document button', async () => {
  renderSpaceDocuments();

  expect(
    await screen.findByText(EMPTY_MESSAGE, {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Novo documento' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('lists the space documents with links', async () => {
  const first = createDocumentIn(INSTALLED_PERSON_ID, CATALOGACAO_SPACE_ID);
  first.title = 'Manual de catalogação';
  const second = createDocumentIn(INSTALLED_PERSON_ID, CATALOGACAO_SPACE_ID);
  second.title = 'Tabela de Cutter';

  renderSpaceDocuments();

  const list = await screen.findByRole('list', {}, LAZY_TIMEOUT);
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  expect(
    within(list).getByRole('link', { name: 'Manual de catalogação' }),
  ).toHaveAttribute('href', paths.document.getHref(first.id));
  expect(
    within(list).getByRole('link', { name: 'Tabela de Cutter' }),
  ).toHaveAttribute('href', paths.document.getHref(second.id));
  expect(
    screen.getByRole('button', { name: 'Novo documento' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
});

test('shows the error with Tentar novamente and refetches', async () => {
  const user = userEvent.setup();
  let requests = 0;
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/documents`, () => {
      requests += 1;
      return requests === 1
        ? HttpResponse.json(
            { message: 'Erro interno do servidor.' },
            { status: 500 },
          )
        : HttpResponse.json({ data: [] });
    }),
  );

  renderSpaceDocuments();

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent(
    'Não foi possível carregar os documentos do espaço.',
  );
  expect(
    screen.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();
  expect(requests).toBe(1);

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByText(EMPTY_MESSAGE, {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(requests).toBe(2);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a 403 shows the direct assignment notice without button nor list', async () => {
  // Restauro inherits from Acervo, where the person is assigned: the space is
  // reached, its documents are not.
  setOrgUnitSpaceAccess('org-unit-restauro', 'inherit');
  addAssignment('org-unit-acervo', INSTALLED_PERSON_ID);

  renderSpaceDocuments('space-org-unit-restauro');

  expect(
    await screen.findByText(DIRECT_ASSIGNMENT_NOTICE, {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Novo documento' }),
  ).toBeNull();
  expect(screen.queryByRole('list')).toBeNull();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('creating a document navigates to it', async () => {
  const user = userEvent.setup();
  let postedBody: unknown = null;
  // Reads the body and returns nothing: the request falls through to the
  // handler of the fake database, which creates the document.
  server.use(
    http.post(`${env.API_URL}/documents`, async ({ request }) => {
      postedBody = await request.clone().json();
    }),
  );
  const router = renderSpaceDocuments();

  await user.click(
    await screen.findByRole('button', { name: 'Novo documento' }, LAZY_TIMEOUT),
  );

  expect(
    await screen.findByText('Página do documento', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(postedBody).toEqual({ spaceId: CATALOGACAO_SPACE_ID });
  expect(router.state.location.pathname).toMatch(/^\/documents\/.+/);
});

test('hides Novo documento when canCreate is false', async () => {
  const document = createDocumentIn(INSTALLED_PERSON_ID, CATALOGACAO_SPACE_ID);
  document.title = 'Manual de catalogação';

  renderSpaceDocuments(CATALOGACAO_SPACE_ID, false);

  const list = await screen.findByRole('list', {}, LAZY_TIMEOUT);
  expect(
    within(list).getByRole('link', { name: 'Manual de catalogação' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();
});

test('shows Nenhum documento neste espaço ainda. when canCreate is false and the list is empty', async () => {
  renderSpaceDocuments(CATALOGACAO_SPACE_ID, false);

  expect(
    await screen.findByText(
      'Nenhum documento neste espaço ainda.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Novo documento' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows Novo documento when canCreate is true', async () => {
  renderSpaceDocuments(CATALOGACAO_SPACE_ID, true);

  expect(
    await screen.findByRole('button', { name: 'Novo documento' }, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
});
