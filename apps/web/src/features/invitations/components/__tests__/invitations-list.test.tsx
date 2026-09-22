import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

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
