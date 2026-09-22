import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
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

// The seeded root unit is named after the organization, which is what the
// description of the confirmation shows.
const UNIT_NAME = 'Biblioteca Municipal de Exemplo';

// Two of the sample people, in the order the pt-BR collator of the fake API
// puts them: Álvaro first, Ana second.
const FIRST_NAME = 'Álvaro Pinheiro';
const SECOND_NAME = 'Ana Lúcia Ferreira';

const seedTwoAssignments = (): void => {
  seedSamplePeople();
  addAssignment(ROOT_ORG_UNIT_ID, 'person-sample-1');
  addAssignment(ROOT_ORG_UNIT_ID, 'person-sample-2');
};

const REMOVE_PATH = `${env.API_URL}/org-units/:orgUnitId/people/:personId`;

const removeAction = (name: string): HTMLElement =>
  screen.getByRole('button', { name: `Remover ${name} desta unidade` });

const findPeopleList = (): Promise<HTMLElement> =>
  screen.findByRole('list', { name: 'Pessoas lotadas' }, LAZY_TIMEOUT);

const findRemoveDialog = (): Promise<HTMLElement> =>
  screen.findByRole(
    'alertdialog',
    { name: 'Remover da unidade?' },
    LAZY_TIMEOUT,
  );

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

// Counts the removals the component sends, answering what the fake API would.
const countRemovals = (): (() => number) => {
  let calls = 0;
  server.use(
    http.delete(REMOVE_PATH, () => {
      calls += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return () => calls;
};

test('each row has a Remover button named after the person', async () => {
  seedTwoAssignments();

  renderApp(<ListHarness />);

  const list = await findPeopleList();

  expect(within(list).getAllByRole('button')).toHaveLength(2);
  expect(removeAction(FIRST_NAME)).toHaveAttribute(
    'title',
    `Remover ${FIRST_NAME} desta unidade`,
  );
  expect(removeAction(SECOND_NAME)).toHaveAttribute(
    'title',
    `Remover ${SECOND_NAME} desta unidade`,
  );
});

test('clicking Remover opens the dialog with the person and the unit in the description', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  const dialog = await findRemoveDialog();
  expect(dialog).toHaveTextContent(`${SECOND_NAME} sai de “${UNIT_NAME}”.`);
  expect(dialog).toHaveTextContent(
    'A pessoa continua na instância e continua lotada nas outras unidades em que estiver; nada além desta lotação é apagado.',
  );
  expect(dialog).toHaveTextContent(
    'Para voltar atrás, basta lotar de novo pela busca acima.',
  );
  expect(screen.getByRole('button', { name: 'Remover' })).toBeInTheDocument();
});

test('Cancelar calls no API and returns the focus to the button', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();
  const removeCalls = countRemovals();

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  const dialog = await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () => expect(removeAction(SECOND_NAME)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
  expect(removeCalls()).toBe(0);
  expect(notificationTitles()).toEqual([]);
});

test('confirming removes the row and notifies with the person name', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  const dialog = await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () => expect(screen.queryByText(SECOND_NAME)).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  expect(screen.getByText(FIRST_NAME)).toBeInTheDocument();
  expect(notificationTitles()).toContain('Pessoa removida');
  expect(notificationMessages()).toContain(
    `${SECOND_NAME} saiu de ${UNIT_NAME}.`,
  );
});

test('removing the second of two focuses the button above', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  await waitFor(
    () => expect(removeAction(FIRST_NAME)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('removing the first of two focuses the new first button', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(FIRST_NAME));

  await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  await waitFor(
    () => expect(removeAction(SECOND_NAME)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('removing the only person focuses the heading and shows the empty state', async () => {
  const user = userEvent.setup();
  seedSamplePeople();
  addAssignment(ROOT_ORG_UNIT_ID, 'person-sample-1');

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(FIRST_NAME));

  await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  expect(
    await screen.findByText(
      'Ninguém está lotado nesta unidade ainda. Use a busca acima para lotar a primeira pessoa.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'Pessoas lotadas' }),
      ).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('a 404 closes the dialog, refetches and notifies a neutral message', async () => {
  const user = userEvent.setup();
  let listCalls = 0;
  server.use(
    http.get(UNIT_PEOPLE_PATH, () => {
      listCalls += 1;
      return HttpResponse.json({
        data:
          listCalls === 1
            ? [
                {
                  id: 'person-sample-1',
                  name: FIRST_NAME,
                  email: 'alvaro.pinheiro@exemplo.com.br',
                },
              ]
            : [],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: UNIT_NAME },
      });
    }),
    http.delete(REMOVE_PATH, () =>
      HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 }),
    ),
  );

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(FIRST_NAME));

  const dialog = await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(listCalls).toBeGreaterThan(1), LAZY_TIMEOUT);
  await screen.findByText(
    'Ninguém está lotado nesta unidade ainda. Use a busca acima para lotar a primeira pessoa.',
    {},
    LAZY_TIMEOUT,
  );

  expect(notificationTitles()).toContain('Lista atualizada');
  expect(notificationMessages()).toContain(
    'A lista foi atualizada: essa pessoa já não estava lotada nesta unidade.',
  );
  expect(notificationTitles()).not.toContain('Pessoa removida');
  // The message of the server never reaches the screen: it would accuse
  // whoever clicked of a mistake that did not happen.
  expect(notificationMessages()).not.toContain('Pessoa não encontrada.');
  expect(document.body.textContent).not.toContain('Pessoa não encontrada.');
});

test('a 500 keeps the dialog open', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();
  server.use(
    http.delete(REMOVE_PATH, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  const dialog = await findRemoveDialog();
  await user.click(screen.getByRole('button', { name: 'Remover' }));

  await waitFor(
    () => expect(notificationTitles()).toContain('Algo deu errado'),
    LAZY_TIMEOUT,
  );
  expect(dialog).toBeInTheDocument();
  expect(screen.getByText(SECOND_NAME)).toBeInTheDocument();
  expect(notificationTitles()).not.toContain('Pessoa removida');
});

test('two Enter presses send a single request', async () => {
  const user = userEvent.setup();
  seedTwoAssignments();

  let removeCalls = 0;
  // The answer is held until the test lets it go, so the second Enter lands
  // while the first request is still pending — no timer anywhere.
  let releaseRemove = (): void => {};
  const held = new Promise<void>((resolve) => {
    releaseRemove = resolve;
  });
  server.use(
    http.delete(REMOVE_PATH, async () => {
      removeCalls += 1;
      await held;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp(<ListHarness />);

  await findPeopleList();
  await user.click(removeAction(SECOND_NAME));

  const dialog = await findRemoveDialog();
  const confirm = screen.getByRole('button', { name: 'Remover' });
  await user.tab();
  expect(confirm).toHaveFocus();

  await user.keyboard('{Enter}{Enter}');

  await waitFor(() => expect(removeCalls).toBe(1), LAZY_TIMEOUT);
  releaseRemove();

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  expect(removeCalls).toBe(1);
});
