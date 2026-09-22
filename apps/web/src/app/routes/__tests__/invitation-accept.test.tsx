import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  getDb,
  type MockInvitation,
  seedInstalled,
  seedSampleInvitations,
} from '@/testing/mocks/db';
import { screen, userEvent, waitFor } from '@/testing/test-utils';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// The invitation link is opened by someone with no session at all.
beforeEach(() => {
  seedInstalled({ signedIn: false });
  seedSampleInvitations();
});

const seededInvitation = (): MockInvitation => {
  const invitation = getDb().invitations[0];
  if (!invitation) throw new Error('The sample invitation was not seeded');
  return invitation;
};

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

test('opening a seeded invitation shows the invited e-mail and the organization', async () => {
  renderRoutes(paths.invitationAccept.getHref(seededInvitation().token));

  expect(
    await screen.findByRole(
      'heading',
      {
        level: 1,
        name: 'Criar sua conta na Biblioteca Municipal de Exemplo',
      },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    await screen.findByText('convidado@exemplo.com.br', {}, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText(/e-mail/i)).toBeNull();
});

test('filling the form signs the new person in and lands on the home screen', async () => {
  const user = userEvent.setup();

  const router = renderRoutes(
    paths.invitationAccept.getHref(seededInvitation().token),
  );

  const name = await screen.findByLabelText('Seu nome', {}, LAZY_TIMEOUT);
  await user.click(name);
  expect(name).toHaveFocus();
  await user.keyboard('Carlos Lima');
  await user.tab();
  expect(screen.getByLabelText('Senha')).toHaveFocus();
  await user.keyboard(MOCK_PASSWORD);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveFocus();
  await user.keyboard('{Enter}');

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
  // The new person, not the one who installed the instance.
  expect(await screen.findByText('Carlos Lima', {}, LAZY_TIMEOUT)).toBeInTheDocument();
});

test('an unknown token shows the generic error screen with the sign-in link', async () => {
  renderRoutes(paths.invitationAccept.getHref('token-que-nao-existe'));

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Convite indisponível' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      'Este link de convite não é válido. Ele pode ter expirado ou já ter sido usado. Se você ainda precisa de acesso, peça um convite novo.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Ir para a tela de entrar' }),
  ).toHaveAttribute('href', '/login');
});

test('an already accepted invitation shows the very same error screen', async () => {
  const invitation = seededInvitation();
  invitation.acceptedAt = new Date().toISOString();

  renderRoutes(paths.invitationAccept.getHref(invitation.token));

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Convite indisponível' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      'Este link de convite não é válido. Ele pode ter expirado ou já ter sido usado. Se você ainda precisa de acesso, peça um convite novo.',
      {},
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('with an admin session in progress an invalid link shows the error screen and keeps the session', async () => {
  seedInstalled({ signedIn: true });
  seedSampleInvitations();

  const router = renderRoutes(
    paths.invitationAccept.getHref('token-que-nao-existe'),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Convite indisponível' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();

  await router.navigate(paths.home.getHref());

  // The session was neither read nor ended by the invitation screen.
  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(await screen.findByText('Ana Souza', {}, LAZY_TIMEOUT)).toBeInTheDocument();
});
