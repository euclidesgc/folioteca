import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { addInvitation, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The real routes of the app, in a memory router.
const renderRoutes = (url: string): ReturnType<typeof createMemoryRouter> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

test('an admin creates an invitation and sees the link and the warning', async () => {
  const user = userEvent.setup();

  renderRoutes(paths.admin.invitations.getHref());

  const headings = await screen.findAllByRole(
    'heading',
    { level: 1 },
    LAZY_TIMEOUT,
  );
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Convites');
  expect(
    screen.getByText(
      'Convide novas pessoas informando o e-mail. O link do convite aparece aqui, uma única vez, e vale por 7 dias.',
    ),
  ).toBeInTheDocument();

  const field = await screen.findByLabelText('E-mail', {}, LAZY_TIMEOUT);
  await user.click(field);
  expect(field).toHaveFocus();
  await user.keyboard('novo.convidado@exemplo.com.br');
  await user.tab();
  expect(
    screen.getByRole('button', { name: 'Criar convite' }),
  ).toHaveFocus();
  await user.keyboard('{Enter}');

  expect(
    await screen.findByRole(
      'heading',
      { name: 'Convite criado para novo.convidado@exemplo.com.br' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Copie o link agora: ele aparece uma única vez e não pode ser mostrado de novo. Se perder, convide o mesmo e-mail outra vez para gerar um link novo.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText<HTMLInputElement>('Link do convite').value,
  ).toContain(`${window.location.origin}/invitations/`);
});

test('a person who is not admin is sent home and no request to invitations is made', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  let invitationsCalls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations`, () => {
      invitationsCalls += 1;
      return HttpResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    }),
  );

  const router = renderRoutes(paths.admin.invitations.getHref());

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(router.state.location.pathname).toBe(paths.home.path),
    LAZY_TIMEOUT,
  );

  expect(
    screen.queryByRole('heading', { level: 1, name: 'Convites' }),
  ).not.toBeInTheDocument();
  expect(invitationsCalls).toBe(0);
});

test('creating a second invitation replaces the link block', async () => {
  const user = userEvent.setup();

  renderRoutes(paths.admin.invitations.getHref());

  const field = await screen.findByLabelText('E-mail', {}, LAZY_TIMEOUT);
  await user.type(field, 'primeiro.convidado@exemplo.com.br');
  await user.click(screen.getByRole('button', { name: 'Criar convite' }));

  const firstLink = await screen.findByLabelText<HTMLInputElement>(
    'Link do convite',
    {},
    LAZY_TIMEOUT,
  );
  const firstValue = firstLink.value;
  expect(firstValue.length).toBeGreaterThan(0);

  await user.type(
    screen.getByLabelText('E-mail'),
    'segundo.convidado@exemplo.com.br',
  );
  await user.click(screen.getByRole('button', { name: 'Criar convite' }));

  expect(
    await screen.findByRole(
      'heading',
      { name: 'Convite criado para segundo.convidado@exemplo.com.br' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () =>
      expect(
        screen.getByLabelText<HTMLInputElement>('Link do convite').value,
      ).not.toBe(firstValue),
    LAZY_TIMEOUT,
  );
  expect(
    screen.queryByRole('heading', {
      name: 'Convite criado para primeiro.convidado@exemplo.com.br',
    }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByLabelText('Link do convite')).toHaveLength(1);
});

// Two pending invitations in the fake database, with times far enough apart
// for "newest first" to be unambiguous. The dates are built from local
// components: the assertions do not depend on the time zone of the machine.
const seedTwoInvitations = (): void => {
  const older = addInvitation({ email: 'antigo.convidado@exemplo.com.br' });
  older.createdAt = new Date(2026, 8, 18, 8, 0).toISOString();
  older.expiresAt = new Date(2126, 8, 25, 8, 0).toISOString();

  const newer = addInvitation({ email: 'recente.convidado@exemplo.com.br' });
  newer.createdAt = new Date(2026, 8, 20, 8, 0).toISOString();
  newer.expiresAt = new Date(2126, 8, 27, 8, 0).toISOString();
};

const pendingItems = (): (string | null)[] =>
  within(screen.getByRole('list', { name: 'Convites pendentes' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

test('an admin sees the two seeded invitations, newest first', async () => {
  seedTwoInvitations();

  renderRoutes(paths.admin.invitations.getHref());

  expect(
    await screen.findByRole(
      'heading',
      { level: 2, name: 'Convites pendentes' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await screen.findByRole(
    'list',
    { name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );

  expect(pendingItems()).toEqual([
    expect.stringContaining('recente.convidado@exemplo.com.br'),
    expect.stringContaining('antigo.convidado@exemplo.com.br'),
  ]);
});

test('creating an invitation puts the new one on top without a reload', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderRoutes(paths.admin.invitations.getHref());

  const field = await screen.findByLabelText('E-mail', {}, LAZY_TIMEOUT);
  await user.type(field, 'novo.convidado@exemplo.com.br');
  await user.click(screen.getByRole('button', { name: 'Criar convite' }));

  await screen.findByText(
    'novo.convidado@exemplo.com.br',
    {},
    LAZY_TIMEOUT,
  );
  await waitFor(
    () =>
      expect(pendingItems()).toEqual([
        expect.stringContaining('novo.convidado@exemplo.com.br'),
        expect.stringContaining('recente.convidado@exemplo.com.br'),
        expect.stringContaining('antigo.convidado@exemplo.com.br'),
      ]),
    LAZY_TIMEOUT,
  );
});

test('a pending invitation for the same e-mail is not duplicated', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderRoutes(paths.admin.invitations.getHref());

  const field = await screen.findByLabelText('E-mail', {}, LAZY_TIMEOUT);
  await user.type(field, 'antigo.convidado@exemplo.com.br');
  await user.click(screen.getByRole('button', { name: 'Criar convite' }));

  // The server replaced the pending invitation of that address, so the
  // reloaded list still has two items — the replaced one now on top.
  await waitFor(
    () =>
      expect(pendingItems()).toEqual([
        expect.stringContaining('antigo.convidado@exemplo.com.br'),
        expect.stringContaining('recente.convidado@exemplo.com.br'),
      ]),
    LAZY_TIMEOUT,
  );
  expect(
    within(
      screen.getByRole('list', { name: 'Convites pendentes' }),
    ).getAllByText('antigo.convidado@exemplo.com.br'),
  ).toHaveLength(1);
});

test('an admin revokes one invitation and still sees the other', async () => {
  const user = userEvent.setup();
  seedTwoInvitations();

  renderRoutes(paths.admin.invitations.getHref());

  await screen.findByRole(
    'list',
    { name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );

  await user.click(
    screen.getByRole('button', {
      name: 'Revogar antigo.convidado@exemplo.com.br',
    }),
  );

  const dialog = await screen.findByRole(
    'alertdialog',
    { name: 'Revogar convite?' },
    LAZY_TIMEOUT,
  );
  await user.click(screen.getByRole('button', { name: 'Revogar' }));

  await waitFor(() => expect(dialog).not.toBeInTheDocument(), LAZY_TIMEOUT);
  await waitFor(
    () =>
      expect(pendingItems()).toEqual([
        expect.stringContaining('recente.convidado@exemplo.com.br'),
      ]),
    LAZY_TIMEOUT,
  );
  // The notification block is mounted by the app provider, which this memory
  // router does not bring: the store is what proves the message.
  expect(
    useNotifications.getState().notifications.map((item) => item.message),
  ).toContain('O convite de antigo.convidado@exemplo.com.br não vale mais.');
});

test('the Convites pendentes heading is still on the page', async () => {
  seedTwoInvitations();

  renderRoutes(paths.admin.invitations.getHref());

  // It moved from the route file to the component, not from its place on the
  // screen: one `<h1>`, and the section heading right above the list.
  const heading = await screen.findByRole(
    'heading',
    { level: 2, name: 'Convites pendentes' },
    LAZY_TIMEOUT,
  );
  expect(heading).toBeInTheDocument();
  expect(
    screen.getByText(
      'O link de cada convite aparece uma única vez, quando ele é criado, e não pode ser mostrado de novo. Para gerar um link novo, convide o mesmo e-mail outra vez.',
    ),
  ).toBeInTheDocument();
  expect(await screen.findAllByRole('heading', { level: 1 }, LAZY_TIMEOUT)).toHaveLength(1);
});

test('a non-admin is sent home without requesting GET /invitations', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  let listCalls = 0;
  server.use(
    http.get(`${env.API_URL}/invitations`, () => {
      listCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
  );

  const router = renderRoutes(paths.admin.invitations.getHref());

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(router.state.location.pathname).toBe(paths.home.path),
    LAZY_TIMEOUT,
  );

  expect(
    screen.queryByRole('heading', { level: 2, name: 'Convites pendentes' }),
  ).not.toBeInTheDocument();
  expect(listCalls).toBe(0);
});
