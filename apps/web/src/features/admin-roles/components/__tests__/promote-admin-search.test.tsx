import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import {
  promotePerson,
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

import { PromoteAdminSearch } from '../promote-admin-search';

// The search debounces and loads: every wait of this file gets an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// Zilda is the last of the seeded people, and both her name and her e-mail
// match the term the tests type.
const ZILDA = 'Zilda Marques';
const ZILDA_ID = 'person-sample-12';
const ZILDA_EMAIL = 'zilda.marques@exemplo.com.br';
const PROMOTE_PATH = `${env.API_URL}/admins/:personId`;

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

// The search, fed by the same admins list the page has on the screen.
function SearchHarness(): React.JSX.Element {
  const query = useAdmins();

  return <PromoteAdminSearch admins={query.data?.data ?? []} />;
}

const findField = (): Promise<HTMLElement> =>
  screen.findByLabelText('Buscar pessoa por nome ou e-mail', {}, LAZY_TIMEOUT);

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

// Counts the promotions that leave the app, answering what the fake API
// would.
const countPromotions = (
  person: { id: string; name: string; email: string } = {
    id: ZILDA_ID,
    name: ZILDA,
    email: ZILDA_EMAIL,
  },
): (() => number) => {
  let calls = 0;
  server.use(
    http.put(PROMOTE_PATH, () => {
      calls += 1;
      promotePerson(ZILDA_ID);
      return HttpResponse.json({ data: person });
    }),
  );

  return () => calls;
};

const openConfirmation = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<{ opener: HTMLElement; dialog: HTMLElement }> => {
  await user.type(await findField(), 'zilda');

  const opener = await screen.findByRole(
    'button',
    { name: `Promover ${ZILDA} a administração` },
    LAZY_TIMEOUT,
  );
  await user.click(opener);

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Promover a administração?' },
    LAZY_TIMEOUT,
  );

  return { opener, dialog };
};

test('an empty field shows nothing below it', async () => {
  renderApp(<SearchHarness />);

  const field = await findField();

  expect(field).toHaveValue('');
  expect(
    screen.getByText('Digite ao menos uma letra. São mostrados até 10 resultados.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('list', { name: 'Resultados da busca' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(ZILDA)).not.toBeInTheDocument();
});

test('a term shows the count and the results', async () => {
  const user = userEvent.setup();

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');

  const results = await screen.findByRole(
    'list',
    { name: 'Resultados da busca' },
    LAZY_TIMEOUT,
  );
  expect(within(results).getByText(ZILDA)).toBeInTheDocument();
  expect(within(results).getByText(ZILDA_EMAIL)).toBeInTheDocument();
  expect(
    within(results).getByRole('button', {
      name: `Promover ${ZILDA} a administração`,
    }),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(screen.getByRole('status')).toHaveTextContent('1 resultado.'),
    LAZY_TIMEOUT,
  );
});

test('someone who already administers shows the Já é administração badge and no button', async () => {
  const user = userEvent.setup();
  promotePerson(ZILDA_ID);

  renderApp(<SearchHarness />);

  await user.type(await findField(), 'zilda');

  const results = await screen.findByRole(
    'list',
    { name: 'Resultados da busca' },
    LAZY_TIMEOUT,
  );
  const row = within(results).getByText(ZILDA).closest('li');
  expect(row).not.toBeNull();
  expect(within(row as HTMLElement).getByText('Já é administração')).toBeInTheDocument();
  expect(
    within(row as HTMLElement).queryByRole('button', {
      name: `Promover ${ZILDA} a administração`,
    }),
  ).not.toBeInTheDocument();
});

test('clicking Promover only opens the dialog and sends no request', async () => {
  const user = userEvent.setup();
  const promotions = countPromotions();

  renderApp(<SearchHarness />);

  const { dialog } = await openConfirmation(user);

  expect(dialog).toHaveTextContent(
    `${ZILDA} passa a administrar esta instância inteira, como qualquer outra administração: cria e renomeia unidades, convida pessoas e vê quem administra. Isso não dá acesso a nenhum documento que a pessoa já não visse. Tirar o papel depois ainda não é possível por aqui.`,
  );
  expect(promotions()).toBe(0);
});

test('cancelling gives the focus back to the button that opened the dialog', async () => {
  const user = userEvent.setup();
  countPromotions();

  renderApp(<SearchHarness />);

  const { opener, dialog } = await openConfirmation(user);

  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(opener).toHaveFocus(), LAZY_TIMEOUT);
});

test('confirming sends exactly one PUT', async () => {
  const user = userEvent.setup();
  const promotions = countPromotions();

  renderApp(<SearchHarness />);

  const { dialog } = await openConfirmation(user);
  await user.click(within(dialog).getByRole('button', { name: 'Promover' }));

  await waitFor(() => expect(promotions()).toBe(1), LAZY_TIMEOUT);
  await waitFor(
    () => expect(notificationTitles()).toContain('Pessoa promovida'),
    LAZY_TIMEOUT,
  );
  expect(promotions()).toBe(1);
});

test('after a success the field is cleared and gets the focus back', async () => {
  const user = userEvent.setup();
  countPromotions();

  renderApp(<SearchHarness />);

  const field = await findField();
  const { dialog } = await openConfirmation(user);
  await user.click(within(dialog).getByRole('button', { name: 'Promover' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(field).toHaveValue(''), LAZY_TIMEOUT);
  await waitFor(() => expect(field).toHaveFocus(), LAZY_TIMEOUT);
  expect(document.activeElement).toBe(field);
});

test('the success notification uses the name the server returned', async () => {
  const user = userEvent.setup();
  // The server answers another name on purpose: what is shown is what came
  // back, never the row that was clicked.
  countPromotions({
    id: ZILDA_ID,
    name: 'Zilda Marques de Albuquerque',
    email: ZILDA_EMAIL,
  });

  renderApp(<SearchHarness />);

  const { dialog } = await openConfirmation(user);
  await user.click(within(dialog).getByRole('button', { name: 'Promover' }));

  await waitFor(
    () =>
      expect(notificationMessages()).toContain(
        'Zilda Marques de Albuquerque agora administra esta instância.',
      ),
    LAZY_TIMEOUT,
  );
  expect(notificationMessages()).not.toContain(
    `${ZILDA} agora administra esta instância.`,
  );
});

test('two quick clicks on the dialog Promover send a single request', async () => {
  const user = userEvent.setup();

  let promoteCalls = 0;
  // The answer is held until the test lets it go, so the second click lands
  // while the first request is still pending — no timer anywhere.
  let releasePromote = (): void => {};
  const held = new Promise<void>((resolve) => {
    releasePromote = resolve;
  });
  server.use(
    http.put(PROMOTE_PATH, async () => {
      promoteCalls += 1;
      await held;
      promotePerson(ZILDA_ID);
      return HttpResponse.json({
        data: { id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL },
      });
    }),
  );

  renderApp(<SearchHarness />);

  const { dialog } = await openConfirmation(user);
  const confirm = within(dialog).getByRole('button', { name: 'Promover' });
  await user.dblClick(confirm);

  await waitFor(() => expect(promoteCalls).toBe(1), LAZY_TIMEOUT);
  releasePromote();

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  expect(promoteCalls).toBe(1);
});

test('a failure keeps the dialog open', async () => {
  const user = userEvent.setup();
  server.use(
    http.put(PROMOTE_PATH, () =>
      HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 }),
    ),
  );

  renderApp(<SearchHarness />);

  const { dialog } = await openConfirmation(user);
  await user.click(within(dialog).getByRole('button', { name: 'Promover' }));

  await waitFor(
    () => expect(notificationMessages()).toContain('Pessoa não encontrada.'),
    LAZY_TIMEOUT,
  );
  expect(dialog).toBeInTheDocument();
  expect(
    within(dialog).getByRole('button', { name: 'Promover' }),
  ).toBeInTheDocument();
  expect(notificationTitles()).not.toContain('Pessoa promovida');
});

test('hasMore shows the trimming notice', async () => {
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
