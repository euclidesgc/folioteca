import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  addFreeSpace,
  listSpacesOf,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { SidebarFreeSpaces } from '../sidebar-free-spaces';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

const serverFailure = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });

const openDialog = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(
    await screen.findByRole('button', { name: 'Novo espaço' }, LAZY_TIMEOUT),
  );
  return screen.findByRole('dialog', { name: 'Novo espaço' }, LAZY_TIMEOUT);
};

// Shows where the router is, so the navigation after creating is visible.
function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  const state: unknown = location.state;
  return (
    <p>
      {`Em ${location.pathname} com ${JSON.stringify(state ?? null)}`}
    </p>
  );
}

test('shows Carregando espaços while loading', async () => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces`, async () => {
      await released;
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<SidebarFreeSpaces />);

  const nav = screen.getByRole('navigation', { name: 'Espaços' });
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Espaços' }),
  ).toBeInTheDocument();
  expect(within(nav).getByRole('status')).toHaveTextContent(
    'Carregando espaços…',
  );

  release();

  expect(
    await screen.findByText('Você ainda não tem espaços.', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
});

test('shows the empty text when the person has no free spaces', async () => {
  // A unit space in the list is not a free space.
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);

  renderApp(<SidebarFreeSpaces />);

  const nav = screen.getByRole('navigation', { name: 'Espaços' });
  expect(
    await within(nav).findByText(
      'Você ainda não tem espaços.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(within(nav).queryByRole('link')).not.toBeInTheDocument();
});

test('on error shows the message and Tentar novamente refetches', async () => {
  const user = userEvent.setup();
  addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  let calls = 0;
  server.use(
    http.get(
      `${env.API_URL}/spaces`,
      () => {
        calls += 1;
        return serverFailure();
      },
      { once: true },
    ),
  );

  renderApp(<SidebarFreeSpaces />);

  const nav = screen.getByRole('navigation', { name: 'Espaços' });
  const alert = await within(nav).findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar seus espaços.');
  expect(calls).toBe(1);

  let retried = 0;
  server.use(
    http.get(`${env.API_URL}/spaces`, () => {
      retried += 1;
      return HttpResponse.json({ data: listSpacesOf(INSTALLED_PERSON_ID) });
    }),
  );

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await within(nav).findByRole(
      'link',
      { name: 'Comissão de Leitura' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(retried).toBe(1);
});

test('renders only free spaces in the received order with the space href', async () => {
  server.use(
    http.get(`${env.API_URL}/spaces`, () =>
      HttpResponse.json({
        data: [
          { id: 'space-free-2', type: 'free', name: 'Arquivo Histórico' },
          { id: 'space-org-unit-catalogacao', type: 'unit', name: 'Catalogação' },
          { id: 'space-free-1', type: 'free', name: 'Comissão de Leitura' },
        ],
      }),
    ),
  );

  renderApp(<SidebarFreeSpaces />);

  const nav = screen.getByRole('navigation', { name: 'Espaços' });
  await within(nav).findByRole(
    'link',
    { name: 'Arquivo Histórico' },
    LAZY_TIMEOUT,
  );
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual([
    'Arquivo Histórico',
    'Comissão de Leitura',
  ]);
  expect(links.map((link) => link.getAttribute('title'))).toEqual([
    'Arquivo Histórico',
    'Comissão de Leitura',
  ]);
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    paths.space.getHref('space-free-2'),
    paths.space.getHref('space-free-1'),
  ]);
});

test('shows the Novo espaço button in every state', async () => {
  server.use(
    http.get(`${env.API_URL}/spaces`, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [] });
    }),
  );
  const loading = renderApp(<SidebarFreeSpaces />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando espaços…');
  expect(
    screen.getByRole('button', { name: 'Novo espaço' }),
  ).toBeInTheDocument();
  loading.unmount();

  server.use(http.get(`${env.API_URL}/spaces`, serverFailure));
  const failed = renderApp(<SidebarFreeSpaces />);
  await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(
    screen.getByRole('button', { name: 'Novo espaço' }),
  ).toBeInTheDocument();
  failed.unmount();

  server.use(
    http.get(`${env.API_URL}/spaces`, () => HttpResponse.json({ data: [] })),
  );
  const empty = renderApp(<SidebarFreeSpaces />);
  await screen.findByText('Você ainda não tem espaços.', {}, LAZY_TIMEOUT);
  expect(
    screen.getByRole('button', { name: 'Novo espaço' }),
  ).toBeInTheDocument();
  empty.unmount();

  server.use(
    http.get(`${env.API_URL}/spaces`, () =>
      HttpResponse.json({
        data: [{ id: 'space-free-1', type: 'free', name: 'Comissão de Leitura' }],
      }),
    ),
  );
  renderApp(<SidebarFreeSpaces />);
  await screen.findByRole('link', { name: 'Comissão de Leitura' }, LAZY_TIMEOUT);
  expect(
    screen.getByRole('button', { name: 'Novo espaço' }),
  ).toBeInTheDocument();
});

test('opening the dialog focuses the Nome field', async () => {
  const user = userEvent.setup();
  renderApp(<SidebarFreeSpaces />);

  const dialog = await openDialog(user);

  expect(
    within(dialog).getByText(
      'Um lugar para um grupo de trabalho, um projeto ou uma comissão. Você será a pessoa dona dele.',
    ),
  ).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Nome')).toHaveFocus();
});

test('Escape closes the dialog and returns focus to Novo espaço', async () => {
  const user = userEvent.setup();
  renderApp(<SidebarFreeSpaces />);

  const dialog = await openDialog(user);
  expect(within(dialog).getByLabelText('Nome')).toHaveFocus();

  await user.keyboard('{Escape}');

  expect(dialog).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Novo espaço' })).toHaveFocus();
});

test('a validation error keeps the dialog open', async () => {
  const user = userEvent.setup();
  renderApp(<SidebarFreeSpaces />);

  const dialog = await openDialog(user);
  await user.click(within(dialog).getByRole('button', { name: 'Criar espaço' }));

  expect(
    await within(dialog).findByText('Informe o nome.', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Nome')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(useNotifications.getState().notifications).toEqual([]);
});

test('creating notifies Espaço criado and navigates to the space', async () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(
    [
      { path: paths.home.path, element: <SidebarFreeSpaces /> },
      {
        path: paths.space.path,
        element: (
          <>
            <SidebarFreeSpaces />
            <LocationProbe />
          </>
        ),
      },
    ],
    { initialEntries: [paths.home.getHref()] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  const dialog = await openDialog(user);
  await user.type(within(dialog).getByLabelText('Nome'), 'Comissão de Leitura');
  await user.click(within(dialog).getByRole('button', { name: 'Criar espaço' }));

  // The id comes from the fake database, which numbers the free spaces.
  const link = await screen.findByRole(
    'link',
    { name: 'Comissão de Leitura' },
    LAZY_TIMEOUT,
  );
  const [created] = listSpacesOf(INSTALLED_PERSON_ID);
  expect(created).toMatchObject({ type: 'free', name: 'Comissão de Leitura' });
  const href = paths.space.getHref(created?.id ?? '');
  expect(
    await screen.findByText(
      `Em ${href} com {"focusMain":true}`,
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(link).toHaveAttribute('href', href);
  expect(
    useNotifications
      .getState()
      .notifications.map(({ type, title }) => ({ type, title })),
  ).toEqual([{ type: 'success', title: 'Espaço criado' }]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(link).toHaveAttribute('aria-current', 'page');
});
