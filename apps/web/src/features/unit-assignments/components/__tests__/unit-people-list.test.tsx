import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';

import { useUnitPeople } from '@/features/unit-assignments/api/get-unit-people';
import {
  addAssignment,
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { UnitPeopleList } from '../unit-people-list';

// The list loads through the query of whoever owns the page: every wait after
// mounting it gets an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The page, reduced to what the list needs: the query, resolved.
function ListHarness(): React.JSX.Element {
  const query = useUnitPeople({ orgUnitId: ROOT_ORG_UNIT_ID });
  return <UnitPeopleList query={query} />;
}

// The route this list reads.
const UNIT_PEOPLE_PATH = `${env.API_URL}/org-units/:orgUnitId/people`;

const answerWith = (
  people: { id: string; name: string; email: string }[],
): void => {
  server.use(
    http.get(UNIT_PEOPLE_PATH, () =>
      HttpResponse.json({
        data: people,
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: 'Biblioteca Municipal de Exemplo' },
      }),
    ),
  );
};

test('shows the loading state', async () => {
  server.use(
    http.get(UNIT_PEOPLE_PATH, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [], orgUnit: { id: '', name: '' } });
    }),
  );

  renderApp(<ListHarness />);

  expect(await screen.findByRole('status', {}, LAZY_TIMEOUT)).toHaveTextContent(
    'Carregando as pessoas lotadas…',
  );
});

test('shows the empty state', async () => {
  renderApp(<ListHarness />);

  expect(
    await screen.findByText(
      'Ninguém está lotado nesta unidade ainda. Use a busca acima para lotar a primeira pessoa.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows the error state with a retry button', async () => {
  const user = userEvent.setup();
  seedSamplePeople();
  addAssignment(ROOT_ORG_UNIT_ID, 'person-sample-12');

  let calls = 0;
  server.use(
    http.get(UNIT_PEOPLE_PATH, () => {
      calls += 1;
      if (calls === 1) {
        return HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        );
      }
      return HttpResponse.json({
        data: [
          {
            id: 'person-sample-12',
            name: 'Zilda Marques',
            email: 'zilda.marques@exemplo.com.br',
          },
        ],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: 'Biblioteca Municipal de Exemplo' },
      });
    }),
  );

  renderApp(<ListHarness />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar as pessoas lotadas.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByText('Zilda Marques', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  await waitFor(() => expect(calls).toBe(2), LAZY_TIMEOUT);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the people in the order given by the server', async () => {
  // The server sends them in its own order on purpose: nothing is reordered
  // on the screen.
  answerWith([
    {
      id: 'person-3',
      name: 'Álvaro Pinheiro',
      email: 'alvaro.pinheiro@exemplo.com.br',
    },
    { id: 'person-2', name: 'ana lúcia', email: 'ana.lucia@exemplo.com.br' },
    { id: 'person-1', name: 'Zilda Marques', email: 'zilda@exemplo.com.br' },
  ]);

  renderApp(<ListHarness />);

  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas lotadas' },
    LAZY_TIMEOUT,
  );

  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    expect.stringContaining('Álvaro Pinheiro'),
    expect.stringContaining('ana lúcia'),
    expect.stringContaining('Zilda Marques'),
  ]);
});

test('a long e-mail does not break the row', async () => {
  const longEmail = `${'pessoa.com.nome.bem.comprido'.padEnd(65, 'x')}@exemplo.com.br`;
  expect(longEmail).toHaveLength(80);

  answerWith([
    { id: 'person-1', name: 'Helena Barros', email: longEmail },
  ]);

  renderApp(<ListHarness />);

  const email = await screen.findByText(longEmail, {}, LAZY_TIMEOUT);

  expect(email).toHaveClass('min-w-0', 'break-words');
  expect(email).not.toHaveClass('truncate');
});
