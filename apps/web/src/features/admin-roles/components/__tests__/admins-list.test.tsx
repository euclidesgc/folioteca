import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { useRef } from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import {
  demotePerson,
  getDb,
  listAdmins,
  type MockPerson,
  seedInstalled,
} from '@/testing/mocks/db';
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
const DEMOTE_PATH = `${env.API_URL}/admins/:personId`;

// Ana is the person of the session; the other two are seeded by the tests that
// need a longer list. The order on screen is the pt-BR one of the server.
const ANA = { id: 'person-1', name: 'Ana Souza', email: 'ana.souza@exemplo.com.br' };
const BEATRIZ = {
  id: 'person-2',
  name: 'Beatriz Nogueira',
  email: 'beatriz.nogueira@exemplo.com.br',
};
const ZILDA = {
  id: 'person-3',
  name: 'Zilda Marques',
  email: 'zilda.marques@exemplo.com.br',
};

// The phrase of the domain, the same one the server answers on the 409.
const LAST_ADMIN_HINT =
  'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The page, reduced to what the list needs: the query, resolved, and the
// search field of the page, which is where the focus lands when no row is
// left to take it.
function ListHarness(): React.JSX.Element {
  const query = useAdmins();
  const searchFieldRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={searchFieldRef}
        type="search"
        aria-label="Buscar pessoa por nome ou e-mail"
      />
      <AdminsList query={query} fallbackFocusRef={searchFieldRef} />
    </>
  );
}

// More administrators than the installation creates: whoever needs a longer
// list seeds it here.
const seedMoreAdmins = (people: MockPerson[]): void => {
  getDb().people.push(...people);
};

const asAdmin = (person: typeof ANA): MockPerson => ({
  ...person,
  isAdmin: true,
});

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

// Counts the demotions that leave the app, answering what the fake API would
// and writing the same change into the fake database.
const countDemotions = (
  person: typeof ANA = BEATRIZ,
): (() => number) => {
  let calls = 0;
  server.use(
    http.delete(DEMOTE_PATH, ({ params }) => {
      calls += 1;
      demotePerson(String(params.personId));
      return HttpResponse.json({ data: person });
    }),
  );

  return () => calls;
};

// Counts the loads of the list, answering from the fake database like the real
// handler does.
const countAdminsLoads = (): (() => number) => {
  let calls = 0;
  server.use(
    http.get(ADMINS_PATH, () => {
      calls += 1;
      return HttpResponse.json({
        data: listAdmins().map(({ id, name, email }) => ({ id, name, email })),
      });
    }),
  );

  return () => calls;
};

const findAdminsList = (): Promise<HTMLElement> =>
  screen.findByRole('list', { name: 'Administradores' }, LAZY_TIMEOUT);

const openConfirmation = async (
  user: ReturnType<typeof userEvent.setup>,
  person: typeof ANA,
): Promise<{ opener: HTMLElement; dialog: HTMLElement }> => {
  await findAdminsList();

  const opener = await screen.findByRole(
    'button',
    { name: `Tirar o papel de administração de ${person.name}` },
    LAZY_TIMEOUT,
  );
  await user.click(opener);

  const dialog = await screen.findByRole('alertdialog', {}, LAZY_TIMEOUT);

  return { opener, dialog };
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

test('every row has a Tirar o papel button, including the you row', async () => {
  seedMoreAdmins([asAdmin(BEATRIZ)]);

  renderApp(<ListHarness />);

  const list = await findAdminsList();
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(2);

  for (const person of [ANA, BEATRIZ]) {
    const button = within(list).getByRole('button', {
      name: `Tirar o papel de administração de ${person.name}`,
    });
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Tirar o papel');
  }

  // The row of whoever is using the app is not spared: the rule is by count,
  // never by identity. The badge only shows once the session has loaded.
  await waitFor(
    () => expect(screen.getByText('você')).toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  const youRow = within(list)
    .getAllByRole('listitem')
    .find((row) => within(row).queryByText('você'));
  if (!youRow) throw new Error('A linha da pessoa da sessão não apareceu.');
  expect(
    within(youRow).getByRole('button', {
      name: `Tirar o papel de administração de ${ANA.name}`,
    }),
  ).toBeInTheDocument();
});

test('clicking Tirar o papel only opens the dialog and sends no request', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  const demotions = countDemotions();

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);

  expect(dialog).toHaveAccessibleName('Tirar o papel de administração?');
  expect(dialog).toHaveTextContent(
    `${BEATRIZ.name} deixa de administrar esta instância: perde a área "Administração" e não poderá mais criar unidades, convidar pessoas nem mudar quem administra. A pessoa continua na instância como membro, e nada do que é dela é apagado. Para devolver o papel, basta promover de novo pela busca acima.`,
  );
  expect(demotions()).toBe(0);
});

test('cancelling gives the focus back to the button that opened the dialog', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  countDemotions();

  renderApp(<ListHarness />);

  const { opener, dialog } = await openConfirmation(user, BEATRIZ);
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(opener).toHaveFocus(), LAZY_TIMEOUT);
});

test('confirming sends exactly one DELETE', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  const demotions = countDemotions();

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(() => expect(demotions()).toBe(1), LAZY_TIMEOUT);
  await waitFor(
    () => expect(notificationTitles()).toContain('Papel de administração retirado'),
    LAZY_TIMEOUT,
  );
  expect(demotions()).toBe(1);
});

test('two quick clicks on the dialog Tirar o papel send a single request', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);

  let demoteCalls = 0;
  // The answer is held until the test lets it go, so the second click lands
  // while the first request is still pending — no timer anywhere.
  let releaseDemote = (): void => {};
  const held = new Promise<void>((resolve) => {
    releaseDemote = resolve;
  });
  server.use(
    http.delete(DEMOTE_PATH, async ({ params }) => {
      demoteCalls += 1;
      await held;
      demotePerson(String(params.personId));
      return HttpResponse.json({ data: BEATRIZ });
    }),
  );

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await user.dblClick(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(() => expect(demoteCalls).toBe(1), LAZY_TIMEOUT);
  releaseDemote();

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  expect(demoteCalls).toBe(1);
});

test('the success notification uses the name the server returned', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  // The server answers another name on purpose: what is shown is what came
  // back, never the row that was clicked.
  countDemotions({ ...BEATRIZ, name: 'Beatriz Nogueira de Alencar' });

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(
    () =>
      expect(notificationMessages()).toContain(
        'Beatriz Nogueira de Alencar deixou de administrar esta instância e continua como membro.',
      ),
    LAZY_TIMEOUT,
  );
  expect(notificationMessages()).not.toContain(
    `${BEATRIZ.name} deixou de administrar esta instância e continua como membro.`,
  );
});

test('the focus goes to the neighbour row button after a success', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ), asAdmin(ZILDA)]);
  countDemotions();

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  // The row right above is the one that takes the place of the one that left.
  await waitFor(
    () =>
      expect(
        screen.getByRole('button', {
          name: `Tirar o papel de administração de ${ANA.name}`,
        }),
      ).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('the focus goes to the search field when only one admin is left', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  countDemotions();

  renderApp(<ListHarness />);

  const field = screen.getByLabelText('Buscar pessoa por nome ou e-mail');
  const { dialog } = await openConfirmation(user, BEATRIZ);
  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  // The only row left cannot be demoted, so its button is born disabled: the
  // focus goes to the field of the page instead.
  await waitFor(() => expect(field).toHaveFocus(), LAZY_TIMEOUT);
});

test('with a single admin the button is disabled and the reason is linked by aria-describedby', async () => {
  renderApp(<ListHarness />);

  const list = await findAdminsList();
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);

  const button = within(list).getByRole('button', {
    name: `Tirar o papel de administração de ${ANA.name}`,
  });
  expect(button).toBeDisabled();

  const hint = screen.getByText(LAST_ADMIN_HINT);
  expect(button).toHaveAttribute('aria-describedby', hint.id);
});

test('a 409 keeps the dialog open and reloads the list', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  const adminsLoads = countAdminsLoads();
  server.use(
    http.delete(DEMOTE_PATH, () =>
      HttpResponse.json({ message: LAST_ADMIN_HINT }, { status: 409 }),
    ),
  );

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await waitFor(() => expect(adminsLoads()).toBe(1), LAZY_TIMEOUT);

  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(
    () => expect(notificationMessages()).toContain(LAST_ADMIN_HINT),
    LAZY_TIMEOUT,
  );
  // The refusal is about the state of the list: the box stays open and the
  // list reloads.
  expect(dialog).toBeInTheDocument();
  await waitFor(() => expect(adminsLoads()).toBe(2), LAZY_TIMEOUT);
  expect(notificationTitles()).not.toContain('Papel de administração retirado');
});

test('a 404 closes the dialog, reloads the list and shows no second notification', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  const adminsLoads = countAdminsLoads();
  server.use(
    http.delete(DEMOTE_PATH, () =>
      HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 }),
    ),
  );

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, BEATRIZ);
  await waitFor(() => expect(adminsLoads()).toBe(1), LAZY_TIMEOUT);

  await user.click(
    within(dialog).getByRole('button', { name: 'Tirar o papel' }),
  );

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(adminsLoads()).toBe(2), LAZY_TIMEOUT);
  // Only the one of the interceptor: the screen says nothing of its own.
  expect(notificationMessages()).toEqual(['Pessoa não encontrada.']);
});

test('the you row opens the first person dialog', async () => {
  const user = userEvent.setup();
  seedMoreAdmins([asAdmin(BEATRIZ)]);
  countDemotions(ANA);

  renderApp(<ListHarness />);

  const { dialog } = await openConfirmation(user, ANA);

  expect(dialog).toHaveAccessibleName(
    'Tirar o seu próprio papel de administração?',
  );
  expect(dialog).toHaveTextContent(
    'Você deixa de administrar esta instância agora: a área "Administração" some do seu app e você volta ao início. Você não poderá devolver o papel a si mesmo — só outra administração poderá. Você continua na instância como membro, com os seus documentos e as suas lotações.',
  );
});
