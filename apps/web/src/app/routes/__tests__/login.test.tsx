import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';
import { screen, userEvent } from '@/testing/test-utils';

const EMAIL = 'ana.souza@exemplo.com.br';

// The whole app, on the real routes, in a memory router.
const renderRoutes = (url: string): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

const signIn = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await screen.findByRole('heading', { level: 1, name: 'Entrar' });
  await user.type(screen.getByLabelText('E-mail'), EMAIL);
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
};

test('shows Entrar as the only h1 with the support text and no sidebar', async () => {
  seedInstalled({ signedIn: false });

  renderRoutes('/login');

  const headings = await screen.findAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Entrar');
  expect(
    screen.getByText('Informe o e-mail e a senha da sua conta na Folioteca.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Navegação principal' }),
  ).not.toBeInTheDocument();
});

test('signing in lands on the internal redirectTo', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });

  renderRoutes(`/login?redirectTo=${encodeURIComponent('/favorites')}`);

  await signIn(user);

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Favoritos' }),
  ).toBeInTheDocument();
});

test('signing in with an external redirectTo lands on the home page', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });

  renderRoutes(
    `/login?redirectTo=${encodeURIComponent('https://exemplo.com.br/roubo')}`,
  );

  await signIn(user);

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
});

test('signing in without redirectTo lands on the home page', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });

  renderRoutes('/login');

  await signIn(user);

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
});

test('with a session the form is never rendered and the app opens', async () => {
  seedInstalled({ signedIn: true });

  renderRoutes('/login');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
});

test('a not installed instance goes to /install', async () => {
  renderRoutes('/login');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instalar a Folioteca',
    }),
  ).toBeInTheDocument();
});

test('a wrong password stays on /login with the alert', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });

  renderRoutes('/login');

  await screen.findByRole('heading', { level: 1, name: 'Entrar' });
  await user.type(screen.getByLabelText('E-mail'), EMAIL);
  await user.type(screen.getByLabelText('Senha'), 'senha-que-nao-confere');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'E-mail ou senha incorretos.',
  );
  expect(
    screen.getByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeInTheDocument();
});
