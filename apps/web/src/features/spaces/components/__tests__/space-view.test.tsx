import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { useSpace } from '@/features/spaces/api/get-space';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  addFreeSpace,
  addSpaceMember,
  seedInstalled,
  seedSampleOrgUnits,
  seedSamplePeople,
  setSpaceMembersCanInvite,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { SpaceView } from '../space-view';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const CATALOGACAO_SPACE_ID = 'space-org-unit-catalogacao';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
});

// The view receives the query from whoever owns the page, as the route does.
function View({ spaceId }: { spaceId: string }): React.JSX.Element {
  const query = useSpace({ spaceId });
  return (
    <SpaceView
      query={query}
      spaceId={spaceId}
      documentsContent={<p>Conteúdo do espaço da unidade</p>}
    />
  );
}

test('shows the loading status with the stable heading', async () => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId`, async () => {
      await released;
      return HttpResponse.json({
        data: {
          id: CATALOGACAO_SPACE_ID,
          type: 'unit',
          name: 'Catalogação',
          reach: 'direct',
          membersCanInvite: false,
        },
      });
    }),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(screen.getByRole('status')).toHaveTextContent('Carregando o espaço…');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    /^Espaço$/,
  );

  release();

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('shows the error alert and retries', async () => {
  const user = userEvent.setup();
  server.use(
    http.get(
      `${env.API_URL}/spaces/:spaceId`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar o espaço.');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    /^Espaço$/,
  );

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows Espaço não encontrado with a link to the home page when the id is not in the list', async () => {
  renderApp(<View spaceId="space-que-nao-existe" />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Espaço não encontrado.');
  expect(alert).toHaveTextContent(
    'Ele não existe ou você não tem acesso a ele.',
  );
  expect(
    within(alert).getByRole('link', { name: 'Voltar para o início' }),
  ).toHaveAttribute('href', paths.home.getHref());
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    /^Espaço$/,
  );
});

test('shows the unit name in the heading and the documents notice when found', async () => {
  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(
    screen.getByText('O espaço de documentos da sua unidade.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Conteúdo do espaço da unidade'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the free space texts when the space is free', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Comissão de Leitura' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Um espaço livre, de que você é dona.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      'Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui.',
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('O espaço de documentos da sua unidade.'),
  ).not.toBeInTheDocument();
});

test('focuses the main element when focusMain is in the location state', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  // The state the sidebar sends after creating a space.
  const router = createMemoryRouter(
    [{ path: paths.space.path, element: <View spaceId={space.id} /> }],
    {
      initialEntries: [
        { pathname: paths.space.getHref(space.id), state: { focusMain: true } },
      ],
    },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );

  const main = screen.getByRole('main');
  expect(main).toHaveFocus();
  expect(main).toHaveAttribute('tabindex', '-1');
});

test('renders documentsContent for a unit space', async () => {
  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(
    await screen.findByText('Conteúdo do espaço da unidade', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Catalogação' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Os documentos deste espaço ainda não chegaram/),
  ).not.toBeInTheDocument();
});

test('renders documentsContent for a free space above Pessoas neste espaço', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  const membersHeading = await screen.findByRole(
    'heading',
    { level: 2, name: 'Pessoas neste espaço' },
    LAZY_TIMEOUT,
  );
  const documentsContent = screen.getByText('Conteúdo do espaço da unidade');
  expect(
    documentsContent.compareDocumentPosition(membersHeading) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('a free space no longer shows the documents notice', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Comissão de Leitura' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Conteúdo do espaço da unidade'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Os documentos deste espaço ainda não chegaram/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Em breve você vai guardar e encontrar documentos aqui/),
  ).not.toBeInTheDocument();
});

test('a 404 shows Espaço não encontrado.', async () => {
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId`, () =>
      HttpResponse.json(
        { message: 'Espaço não encontrado.' },
        { status: 404 },
      ),
    ),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Espaço não encontrado.');
  expect(alert).toHaveTextContent(
    'Ele não existe ou você não tem acesso a ele.',
  );
  expect(
    within(alert).getByRole('link', { name: 'Voltar para o início' }),
  ).toBeInTheDocument();
  expect(
    within(alert).queryByRole('button', { name: 'Tentar novamente' }),
  ).not.toBeInTheDocument();
});

test('another error shows Tentar novamente and refetches', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId`, () => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json(
            { message: 'Erro interno do servidor.' },
            { status: 500 },
          )
        : HttpResponse.json({
            data: {
              id: CATALOGACAO_SPACE_ID,
              type: 'unit',
              name: 'Catalogação',
              reach: 'direct',
              membersCanInvite: false,
            },
          });
    }),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar o espaço.');
  expect(alert).not.toHaveTextContent('Espaço não encontrado.');
  expect(calls).toBe(1);

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(calls).toBe(2);
});

test('a unit space shows the members after unitContent', async () => {
  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  const membersHeading = await screen.findByRole(
    'heading',
    { level: 2, name: 'Pessoas nesta unidade' },
    LAZY_TIMEOUT,
  );
  const unitContent = screen.getByText('Conteúdo do espaço da unidade');
  expect(
    unitContent.compareDocumentPosition(membersHeading) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas nesta unidade' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(list).toHaveTextContent('Ana Souza');
});

test('a free space does not show the members', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  await screen.findByRole(
    'heading',
    { level: 1, name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  expect(
    screen.queryByRole('heading', { name: 'Pessoas nesta unidade' }),
  ).not.toBeInTheDocument();
});

test('a FREE space shows Adicionar pessoa to its owner', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'button',
      { name: 'Adicionar pessoa' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Um espaço livre, de que você é dona.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Um espaço livre de que você é membro.'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      'Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui.',
    ),
  ).not.toBeInTheDocument();
});

test('a FREE space shows the member description without Adicionar pessoa when closed', async () => {
  seedSamplePeople();
  const ownerId = 'person-sample-1';
  const space = addFreeSpace(ownerId, 'Clube do Livro');
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Clube do Livro' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Um espaço livre de que você é membro.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Um espaço livre, de que você é dona.'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Adicionar pessoa' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      'Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui.',
    ),
  ).not.toBeInTheDocument();
});

test('a FREE space shows Pessoas neste espaço with Remover to its owner', async () => {
  seedSamplePeople();
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  addSpaceMember(INSTALLED_PERSON_ID, space.id, 'person-sample-3');

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 2, name: 'Pessoas neste espaço' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas neste espaço' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  expect(
    within(list).getByRole('button', { name: 'Remover Beatriz Nogueira' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(
      'Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui.',
    ),
  ).not.toBeInTheDocument();
});

test('a FREE space shows Pessoas neste espaço without Remover to a member', async () => {
  seedSamplePeople();
  const ownerId = 'person-sample-1';
  const space = addFreeSpace(ownerId, 'Clube do Livro');
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);
  addSpaceMember(ownerId, space.id, 'person-sample-3');

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 2, name: 'Pessoas neste espaço' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas neste espaço' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  expect(
    screen.queryAllByRole('button', { name: /^Remover/ }),
  ).toHaveLength(0);
});

test('a FREE space shows the invite mode control to its owner', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');

  renderApp(<View spaceId={space.id} />);

  const group = await screen.findByRole(
    'group',
    { name: 'Quem adiciona pessoas' },
    LAZY_TIMEOUT,
  );
  expect(
    within(group).getByRole('radio', { name: 'Só eu adiciono pessoas' }),
  ).toBeChecked();
  expect(
    within(group).getByRole('radio', {
      name: 'Qualquer membro adiciona pessoas',
    }),
  ).not.toBeChecked();
  const addButton = screen.getByRole('button', { name: 'Adicionar pessoa' });
  expect(
    group.compareDocumentPosition(addButton) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('a FREE space does not show the invite mode control to a member', async () => {
  seedSamplePeople();
  const ownerId = 'person-sample-1';
  const space = addFreeSpace(ownerId, 'Clube do Livro');
  setSpaceMembersCanInvite(space.id, true);
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Clube do Livro' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Quem adiciona pessoas' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: 'Só eu adiciono pessoas' }),
  ).not.toBeInTheDocument();
});

test('a FREE space shows Adicionar pessoa to a member when open', async () => {
  seedSamplePeople();
  const ownerId = 'person-sample-1';
  const space = addFreeSpace(ownerId, 'Clube do Livro');
  setSpaceMembersCanInvite(space.id, true);
  addSpaceMember(ownerId, space.id, INSTALLED_PERSON_ID);

  renderApp(<View spaceId={space.id} />);

  expect(
    await screen.findByRole(
      'button',
      { name: 'Adicionar pessoa' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Um espaço livre de que você é membro.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Quem adiciona pessoas' }),
  ).not.toBeInTheDocument();
});

test('a unit space shows neither the invite mode control nor Adicionar pessoa', async () => {
  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Quem adiciona pessoas' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Adicionar pessoa' }),
  ).not.toBeInTheDocument();
});
