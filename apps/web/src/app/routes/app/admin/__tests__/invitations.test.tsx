import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor } from '@/testing/test-utils';

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
