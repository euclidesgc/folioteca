import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { useUnitPeople } from '@/features/unit-assignments/api/get-unit-people';
import { queryConfig } from '@/lib/react-query';
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
import { AssignPersonSearch } from '../assign-person-search';

// The search debounces and loads: every wait of this file gets an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const ORGANIZATION_NAME = 'Biblioteca Municipal de Exemplo';
const UNIT_PEOPLE_PATH = `${env.API_URL}/org-units/:orgUnitId/people`;

// Zilda is the last of the seeded people, and both her name and her e-mail
// match the term the tests type.
const ZILDA = 'Zilda Marques';
const ZILDA_ID = 'person-sample-12';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
  useNotifications.setState({ notifications: [] });
});

// The page, reduced to the two blocks that talk to each other: the search
// marks who is already in the list that is right below it.
function SearchHarness(): React.JSX.Element {
  const query = useUnitPeople({ orgUnitId: ROOT_ORG_UNIT_ID });

  if (!query.data) return <p>Carregando a unidade…</p>;

  return (
    <>
      <AssignPersonSearch
        orgUnitId={ROOT_ORG_UNIT_ID}
        orgUnitName={query.data.orgUnit.name}
        assignedPeople={query.data.data}
      />
      <UnitPeopleList query={query} />
    </>
  );
}

const findField = (): Promise<HTMLElement> =>
  screen.findByLabelText('Buscar pessoa por nome ou e-mail', {}, LAZY_TIMEOUT);

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

// Counts the searches that leave the app, answering what the fake API would.
const countSearches = (): (() => number) => {
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/people`, ({ request }) => {
      calls += 1;
      const term = new URL(request.url).searchParams.get('q') ?? '';
      return HttpResponse.json({
        data:
          term.length > 0
            ? [
                {
                  id: ZILDA_ID,
                  name: ZILDA,
                  email: 'zilda.marques@exemplo.com.br',
                },
              ]
            : [],
        hasMore: false,
      });
    }),
  );

  return () => calls;
};

// Counts the reads of the people of the unit, answering an empty unit.
const countUnitPeople = (): (() => number) => {
  let calls = 0;
  server.use(
    http.get(UNIT_PEOPLE_PATH, () => {
      calls += 1;
      return HttpResponse.json({
        data: [],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: ORGANIZATION_NAME },
      });
    }),
  );

  return () => calls;
};

test('typing a term shows the results', async () => {
  const user = userEvent.setup();

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');

  const results = await screen.findByRole(
    'list',
    { name: 'Resultados da busca' },
    LAZY_TIMEOUT,
  );
  expect(within(results).getByText(ZILDA)).toBeInTheDocument();
  expect(
    within(results).getByRole('button', { name: `Lotar ${ZILDA}` }),
  ).toBeInTheDocument();
  await waitFor(
    () =>
      expect(screen.getByRole('status')).toHaveTextContent('1 resultado.'),
    LAZY_TIMEOUT,
  );
});

test('an empty term asks for nothing', async () => {
  const user = userEvent.setup();
  const searches = countSearches();

  renderApp(<SearchHarness />);

  const field = await findField();
  await user.type(field, 'zilda');
  await screen.findByText(ZILDA, {}, LAZY_TIMEOUT);

  await user.clear(field);
  await waitFor(
    () => expect(screen.queryByText(ZILDA)).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );

  // The term that comes after the empty one proves the empty one asked
  // nothing: two terms, two requests.
  await user.type(field, 'marques');
  await waitFor(() => expect(searches()).toBe(2), LAZY_TIMEOUT);
  await screen.findByText(ZILDA, {}, LAZY_TIMEOUT);
  // Two terms typed, two requests: the empty term in between asked nothing.
  expect(searches()).toBe(2);
});

test('someone already assigned shows the Já lotado badge and no button', async () => {
  const user = userEvent.setup();
  addAssignment(ROOT_ORG_UNIT_ID, ZILDA_ID);

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');

  const results = await screen.findByRole(
    'list',
    { name: 'Resultados da busca' },
    LAZY_TIMEOUT,
  );
  expect(within(results).getByText('Já lotado')).toBeInTheDocument();
  expect(
    within(results).queryByRole('button', { name: `Lotar ${ZILDA}` }),
  ).not.toBeInTheDocument();
});

test('clicking Lotar assigns, adds the person to the list and notifies', async () => {
  const user = userEvent.setup();

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');
  await user.click(
    await screen.findByRole(
      'button',
      { name: `Lotar ${ZILDA}` },
      LAZY_TIMEOUT,
    ),
  );

  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas lotadas' },
    LAZY_TIMEOUT,
  );
  await waitFor(
    () => expect(within(list).getByText(ZILDA)).toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  expect(notificationTitles()).toContain('Pessoa lotada');
  expect(notificationMessages()).toContain(
    `${ZILDA} agora está lotado em ${ORGANIZATION_NAME}.`,
  );
});

test('after a successful assignment the field is cleared and focused', async () => {
  const user = userEvent.setup();

  renderApp(<SearchHarness />);

  const field = await findField();
  await user.type(field, 'zilda');
  await user.click(
    await screen.findByRole(
      'button',
      { name: `Lotar ${ZILDA}` },
      LAZY_TIMEOUT,
    ),
  );

  const list = await screen.findByRole(
    'list',
    { name: 'Pessoas lotadas' },
    LAZY_TIMEOUT,
  );
  // The invalidation is awaited: the person is already in the list when the
  // field gets the focus back.
  await waitFor(
    () => expect(within(list).getByText(ZILDA)).toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  await waitFor(() => expect(field).toHaveValue(''), LAZY_TIMEOUT);
  expect(field).toHaveFocus();
});

test('two Enter presses send a single request', async () => {
  const user = userEvent.setup();

  let assignCalls = 0;
  // The answer is held until the test lets it go, so the second Enter lands
  // while the first request is still pending — no timer anywhere.
  let releaseAssign = (): void => {};
  const held = new Promise<void>((resolve) => {
    releaseAssign = resolve;
  });
  server.use(
    http.post(UNIT_PEOPLE_PATH, async () => {
      assignCalls += 1;
      await held;
      addAssignment(ROOT_ORG_UNIT_ID, ZILDA_ID);
      return HttpResponse.json(
        {
          data: {
            id: ZILDA_ID,
            name: ZILDA,
            email: 'zilda.marques@exemplo.com.br',
          },
        },
        { status: 201 },
      );
    }),
  );

  renderApp(<SearchHarness />);

  const field = await findField();
  await user.type(field, 'zilda');

  const assign = await screen.findByRole(
    'button',
    { name: `Lotar ${ZILDA}` },
    LAZY_TIMEOUT,
  );
  assign.focus();
  await user.keyboard('{Enter}{Enter}');

  await waitFor(() => expect(assignCalls).toBe(1), LAZY_TIMEOUT);
  releaseAssign();

  await waitFor(() => expect(field).toHaveValue(''), LAZY_TIMEOUT);
  expect(assignCalls).toBe(1);
});

test('a 409 shows the server message in an alert and refetches the list', async () => {
  const user = userEvent.setup();
  const unitPeople = countUnitPeople();
  countSearches();
  server.use(
    http.post(UNIT_PEOPLE_PATH, () =>
      HttpResponse.json(
        { message: 'Esta pessoa já está lotada nesta unidade.' },
        { status: 409 },
      ),
    ),
  );

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');
  await waitFor(() => expect(unitPeople()).toBe(1), LAZY_TIMEOUT);
  await user.click(
    await screen.findByRole(
      'button',
      { name: `Lotar ${ZILDA}` },
      LAZY_TIMEOUT,
    ),
  );

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Esta pessoa já está lotada nesta unidade.');
  // The screen was stale: the list of assigned people is read again.
  await waitFor(() => expect(unitPeople()).toBeGreaterThan(1), LAZY_TIMEOUT);
  expect(notificationTitles()).toEqual([]);
});

test('a 404 of the person shows the server message in an alert and refetches the search', async () => {
  const user = userEvent.setup();
  const searches = countSearches();
  server.use(
    http.post(UNIT_PEOPLE_PATH, () =>
      HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 }),
    ),
  );

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');
  await waitFor(() => expect(searches()).toBe(1), LAZY_TIMEOUT);
  await user.click(
    await screen.findByRole(
      'button',
      { name: `Lotar ${ZILDA}` },
      LAZY_TIMEOUT,
    ),
  );

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Pessoa não encontrada.');
  // The person is gone: the search is made again.
  await waitFor(() => expect(searches()).toBeGreaterThan(1), LAZY_TIMEOUT);
  expect(notificationTitles()).toEqual([]);
});

test('hasMore shows the refine message', async () => {
  const user = userEvent.setup();

  renderApp(<SearchHarness />);

  // Every seeded person has the same e-mail domain: more people match than
  // the ten the server answers with.
  await user.type(await findField(), 'exemplo');

  expect(
    await screen.findByText(
      'Há mais resultados do que os 10 mostrados. Refine a busca.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('the no access notice is on the screen', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), {
    initialEntries: [paths.admin.orgUnitPeople.getHref(ROOT_ORG_UNIT_ID)],
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await findField();
  expect(
    screen.getByText(
      'Lotação ainda não dá acesso a documento: ninguém passa a ver nada por estar lotado aqui. O acesso chega com os espaços de unidade e o compartilhamento com unidade.',
    ),
  ).toBeInTheDocument();
});
