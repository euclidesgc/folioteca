import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import { getDb, type MockPerson, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { AdminsList } from '../admins-list';

// The list loads through the query of whoever owns the page: every wait after
// mounting it gets an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// The route this list reads.
const ADMINS_PATH = `${env.API_URL}/admins`;

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The page, reduced to what the list needs: the query, resolved.
function ListHarness(): React.JSX.Element {
  const query = useAdmins();
  return <AdminsList query={query} />;
}

// More administrators than the installation creates: nothing in the app
// promotes anyone yet, so whoever needs a longer list seeds it here.
const seedMoreAdmins = (people: MockPerson[]): void => {
  getDb().people.push(...people);
};

test('shows the loading state with role status', async () => {
  server.use(
    http.get(ADMINS_PATH, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<ListHarness />);

  expect(await screen.findByRole('status', {}, LAZY_TIMEOUT)).toHaveTextContent(
    'Carregando administradores…',
  );
});

test('shows the empty state when nobody administers the instance', async () => {
  server.use(http.get(ADMINS_PATH, () => HttpResponse.json({ data: [] })));

  renderApp(<ListHarness />);

  expect(
    await screen.findByText(
      'Ninguém administra esta instância. Isso não deveria acontecer: para voltar a ter uma administração, é preciso marcar alguém direto no banco de dados.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows the error state with an alert and a retry button', async () => {
  server.use(
    http.get(ADMINS_PATH, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<ListHarness />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent(
    'Não foi possível carregar os administradores.',
  );
  expect(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  ).toBeInTheDocument();
});

test('Tentar novamente goes back to loading and then shows the list', async () => {
  const user = userEvent.setup();

  let calls = 0;
  server.use(
    http.get(ADMINS_PATH, async () => {
      calls += 1;
      if (calls === 1) {
        return HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        );
      }
      // Slow enough for the loading state to be observed before the data.
      await delay(20);
      return HttpResponse.json({
        data: [
          {
            id: 'person-1',
            name: 'Ana Souza',
            email: 'ana.souza@exemplo.com.br',
          },
        ],
      });
    }),
  );

  renderApp(<ListHarness />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(await screen.findByRole('status', {}, LAZY_TIMEOUT)).toHaveTextContent(
    'Carregando administradores…',
  );
  expect(
    await screen.findByRole('list', { name: 'Administradores' }, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
});

test('a single admin gets the singular count', async () => {
  renderApp(<ListHarness />);

  expect(
    await screen.findByText(
      'Só uma pessoa administra esta instância.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    within(
      await screen.findByRole(
        'list',
        { name: 'Administradores' },
        LAZY_TIMEOUT,
      ),
    ).getAllByRole('listitem'),
  ).toHaveLength(1);
});

test('three admins get the plural count', async () => {
  seedMoreAdmins([
    {
      id: 'person-2',
      name: 'Beatriz Nogueira',
      email: 'beatriz.nogueira@exemplo.com.br',
      isAdmin: true,
    },
    {
      id: 'person-3',
      name: 'Zilda Marques',
      email: 'zilda.marques@exemplo.com.br',
      isAdmin: true,
    },
  ]);

  renderApp(<ListHarness />);

  expect(
    await screen.findByText(
      '3 pessoas administram esta instância.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  const list = await screen.findByRole(
    'list',
    { name: 'Administradores' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(3);
});

test('the você badge shows once, on the row of the session person', async () => {
  // A namesake of the person in the session: the badge cannot come out of a
  // comparison by name.
  seedMoreAdmins([
    {
      id: 'person-2',
      name: 'Ana Souza',
      email: 'ana.souza.homonima@exemplo.com.br',
      isAdmin: true,
    },
  ]);

  renderApp(<ListHarness />);

  await screen.findByRole('list', { name: 'Administradores' }, LAZY_TIMEOUT);
  await waitFor(
    () => expect(screen.getAllByText('você')).toHaveLength(1),
    LAZY_TIMEOUT,
  );

  const rows = within(
    screen.getByRole('list', { name: 'Administradores' }),
  ).getAllByRole('listitem');
  const sessionRow = rows.find((row) =>
    row.textContent?.includes('ana.souza@exemplo.com.br'),
  );
  if (!sessionRow) throw new Error('A linha da pessoa da sessão não apareceu.');
  expect(within(sessionRow).getByText('você')).toBeInTheDocument();
});

test('the loaded list has no button at all', async () => {
  renderApp(<ListHarness />);

  await screen.findByRole('list', { name: 'Administradores' }, LAZY_TIMEOUT);

  // The proof that the page is read-only: nothing to press on a loaded list.
  expect(screen.queryAllByRole('button')).toEqual([]);
});
