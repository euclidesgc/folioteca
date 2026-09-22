import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { addInvitation, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { InvitationsList } from '../invitations-list';

// The component loads its own data: every wait after mounting it gets an
// explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// Dates are built from local components, never from a fixed instant: the
// expected text is the same in any time zone the suite runs in.
const CREATED_AT = new Date(2026, 8, 20, 9, 5);
const EXPIRES_AT = new Date(2026, 8, 27, 9, 5);

type ListedInvitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

const answerWith = (invitations: ListedInvitation[]): void => {
  server.use(
    http.get(`${env.API_URL}/invitations`, () =>
      HttpResponse.json({ data: invitations }),
    ),
  );
};

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('shows the loading state with role status', async () => {
  server.use(
    http.get(`${env.API_URL}/invitations`, async () => {
      await delay('infinite');
      return HttpResponse.json({ data: [] });
    }),
  );

  renderApp(<InvitationsList />);

  expect(await screen.findByRole('status', {}, LAZY_TIMEOUT)).toHaveTextContent(
    'Carregando convites…',
  );
});

test('shows the error state with role alert and retries on Tentar novamente', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/invitations`, () => {
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
            id: 'invitation-1',
            email: 'convidado@exemplo.com.br',
            createdAt: CREATED_AT.toISOString(),
            expiresAt: EXPIRES_AT.toISOString(),
          },
        ],
      });
    }),
  );

  renderApp(<InvitationsList />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar os convites.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByText('convidado@exemplo.com.br', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  await waitFor(() => expect(calls).toBe(2), LAZY_TIMEOUT);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the empty state', async () => {
  renderApp(<InvitationsList />);

  expect(
    await screen.findByText('Nenhum convite pendente.', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('shows the invited e-mail with Criado em and Expira em in pt-BR', async () => {
  answerWith([
    {
      id: 'invitation-1',
      email: 'convidado@exemplo.com.br',
      createdAt: CREATED_AT.toISOString(),
      expiresAt: EXPIRES_AT.toISOString(),
    },
  ]);

  renderApp(<InvitationsList />);

  const list = await screen.findByRole(
    'list',
    { name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );
  const item = within(list).getByRole('listitem');

  expect(item).toHaveTextContent('convidado@exemplo.com.br');
  expect(within(item).getByText('Criado em')).toBeInTheDocument();
  expect(within(item).getByText('Expira em')).toBeInTheDocument();

  const created = within(item).getByText('20/09/2026, 09:05');
  expect(created).toHaveAttribute('datetime', CREATED_AT.toISOString());
  const expires = within(item).getByText('27/09/2026, 09:05');
  expect(expires).toHaveAttribute('datetime', EXPIRES_AT.toISOString());
});

test('keeps the order the API sent', async () => {
  answerWith([
    {
      id: 'invitation-antigo',
      email: 'antigo@exemplo.com.br',
      createdAt: new Date(2026, 8, 18, 8, 0).toISOString(),
      expiresAt: EXPIRES_AT.toISOString(),
    },
    {
      id: 'invitation-novo',
      email: 'novo@exemplo.com.br',
      createdAt: new Date(2026, 8, 22, 8, 0).toISOString(),
      expiresAt: EXPIRES_AT.toISOString(),
    },
  ]);

  renderApp(<InvitationsList />);

  const list = await screen.findByRole(
    'list',
    { name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );

  // The API sent the oldest one first on purpose: the component reorders
  // nothing, so the screen reads in exactly that order.
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual([
    expect.stringContaining('antigo@exemplo.com.br'),
    expect.stringContaining('novo@exemplo.com.br'),
  ]);
});

test('renders no link and no token-like text', async () => {
  const invitation = addInvitation({ email: 'convidado@exemplo.com.br' });

  renderApp(<InvitationsList />);

  const list = await screen.findByRole(
    'list',
    { name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );

  expect(screen.queryAllByRole('link')).toEqual([]);
  expect(list.querySelector('a')).toBeNull();
  expect(document.body.textContent).not.toContain(invitation.token);
  expect(document.body.textContent).not.toMatch(/token/i);
  expect(document.body.innerHTML).not.toContain(invitation.token);
});

test('an eighty character e-mail wraps instead of overflowing', async () => {
  const longEmail = `${'convidado.com.nome.bem.comprido'.padEnd(65, 'x')}@exemplo.com.br`;
  expect(longEmail).toHaveLength(80);

  answerWith([
    {
      id: 'invitation-1',
      email: longEmail,
      createdAt: CREATED_AT.toISOString(),
      expiresAt: EXPIRES_AT.toISOString(),
    },
  ]);

  renderApp(<InvitationsList />);

  const email = await screen.findByText(longEmail, {}, LAZY_TIMEOUT);

  expect(email).toHaveClass('min-w-0', 'break-words');
  expect(email).not.toHaveClass('truncate');
});

// Two pending invitations in the fake database, with times far enough apart
// for "newest first" to be unambiguous, and expiry dates far in the future so
// they stay pending. The dates are built from local components: the
// assertions do not depend on the time zone of the machine.
const OLDER_EMAIL = 'antigo.convidado@exemplo.com.br';
const NEWER_EMAIL = 'recente.convidado@exemplo.com.br';

const seedTwoInvitations = (): void => {
  const older = addInvitation({ email: OLDER_EMAIL });
  older.createdAt = new Date(2026, 8, 18, 8, 0).toISOString();
  older.expiresAt = new Date(2126, 8, 25, 8, 0).toISOString();

  const newer = addInvitation({ email: NEWER_EMAIL });
  newer.createdAt = new Date(2026, 8, 20, 8, 0).toISOString();
  newer.expiresAt = new Date(2126, 8, 27, 8, 0).toISOString();
};

const revokeAction = (email: string): HTMLElement =>
  screen.getByRole('button', { name: `Revogar ${email}` });

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const notificationMessages = (): (string | undefined)[] =>
  useNotifications.getState().notifications.map((item) => item.message);

const findPendingList = (): Promise<HTMLElement> =>
  screen.findByRole('list', { name: 'Convites pendentes' }, LAZY_TIMEOUT);

// Counts the revokes the component sends, answering what the fake API would.
const countRevokes = (): (() => number) => {
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations/:invitationId/revoke`, () => {
      calls += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return () => calls;
};

test('each item has a Revogar button named after the e-mail', async () => {
  seedTwoInvitations();

  renderApp(<InvitationsList />);

  const list = await findPendingList();

  expect(within(list).getAllByRole('button')).toHaveLength(2);
  expect(revokeAction(NEWER_EMAIL)).toHaveAttribute(
    'title',
    `Revogar ${NEWER_EMAIL}`,
  );
  expect(revokeAction(OLDER_EMAIL)).toHaveAttribute(
    'title',
    `Revogar ${OLDER_EMAIL}`,
  );
});

test('clicking Revogar opens the dialog with the e-mail in the description', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  expect(dialog).toHaveTextContent(
    `O convite de “${OLDER_EMAIL}” deixa de valer agora, e o link enviado para de funcionar.`,
  );
  expect(dialog).toHaveTextContent('Não é possível desfazer nem reenviar');
  expect(dialog).toHaveTextContent(
    'convide de novo no formulário acima, o que gera um link novo.',
  );
  expect(
    screen.getByRole('button', { name: 'Revogar' }),
  ).toBeInTheDocument();
});

test('Cancelar calls no API and returns the focus to the button', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();
  const revokeCalls = countRevokes();

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () => expect(revokeAction(OLDER_EMAIL)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
  expect(revokeCalls()).toBe(0);
  expect(notificationTitles()).toEqual([]);
});

test('confirming revokes, removes the row and notifies', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () => expect(screen.queryByText(OLDER_EMAIL)).not.toBeInTheDocument(),
    LAZY_TIMEOUT,
  );
  expect(screen.getByText(NEWER_EMAIL)).toBeInTheDocument();
  expect(notificationTitles()).toContain('Convite revogado');
  expect(notificationMessages()).toContain(
    `O convite de ${OLDER_EMAIL} não vale mais.`,
  );
});

test('revoking the second of two focuses the button above', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderApp(<InvitationsList />);

  // Newest first: the older invitation is the second row of the list.
  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(
    () => expect(revokeAction(NEWER_EMAIL)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('revoking the first of two focuses the new first button', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(NEWER_EMAIL));

  await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(
    () => expect(revokeAction(OLDER_EMAIL)).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('revoking the only invitation focuses the heading', async () => {
  const user = userEvent.setup();
  const only = addInvitation({ email: 'unico.convidado@exemplo.com.br' });

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(only.email));

  await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await screen.findByText('Nenhum convite pendente.', {}, LAZY_TIMEOUT);
  await waitFor(
    () =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'Convites pendentes' }),
      ).toHaveFocus(),
    LAZY_TIMEOUT,
  );
});

test('a 404 closes the dialog, refetches and notifies', async () => {
  const user = userEvent.setup();
  let listCalls = 0;
  server.use(
    http.get(`${env.API_URL}/invitations`, () => {
      listCalls += 1;
      return HttpResponse.json({
        data:
          listCalls === 1
            ? [
                {
                  id: 'invitation-1',
                  email: 'convidado@exemplo.com.br',
                  createdAt: CREATED_AT.toISOString(),
                  expiresAt: EXPIRES_AT.toISOString(),
                },
              ]
            : [],
      });
    }),
    http.post(`${env.API_URL}/invitations/:invitationId/revoke`, () =>
      HttpResponse.json({ message: 'Convite indisponível.' }, { status: 404 }),
    ),
  );

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction('convidado@exemplo.com.br'));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(() => expect(listCalls).toBeGreaterThan(1), LAZY_TIMEOUT);
  await screen.findByText('Nenhum convite pendente.', {}, LAZY_TIMEOUT);
  // The message comes from the interceptor, and says nothing about a revoke.
  expect(notificationMessages()).toContain('Convite indisponível.');
  expect(notificationTitles()).not.toContain('Convite revogado');
  expect(document.body.textContent).not.toMatch(/revogado por/i);
  // The row is gone here just like after a success, so the focus follows the
  // same rule instead of falling to the body.
  expect(
    screen.getByRole('heading', { level: 2, name: 'Convites pendentes' }),
  ).toHaveFocus();
});

test('a 500 keeps the dialog open', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();
  server.use(
    http.post(`${env.API_URL}/invitations/:invitationId/revoke`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(
    () => expect(notificationTitles()).toContain('Algo deu errado'),
    LAZY_TIMEOUT,
  );
  expect(dialog).toBeInTheDocument();
  expect(screen.getByText(OLDER_EMAIL)).toBeInTheDocument();
  expect(notificationTitles()).not.toContain('Convite revogado');
});

test('two Enter presses send a single request', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  let revokeCalls = 0;
  // The answer is held until the test lets it go, so the second Enter lands
  // while the first request is still pending — no timer anywhere.
  let releaseRevoke = (): void => {};
  const held = new Promise<void>((resolve) => {
    releaseRevoke = resolve;
  });
  server.use(
    http.post(`${env.API_URL}/invitations/:invitationId/revoke`, async () => {
      revokeCalls += 1;
      await held;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp(<InvitationsList />);

  await findPendingList();
  await user.click(revokeAction(OLDER_EMAIL));

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  const confirm = screen.getByRole('button', { name: 'Revogar' });
  await user.tab();
  expect(confirm).toHaveFocus();

  await user.keyboard('{Enter}{Enter}');

  await waitFor(() => expect(revokeCalls).toBe(1), LAZY_TIMEOUT);
  releaseRevoke();

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  expect(revokeCalls).toBe(1);
});
