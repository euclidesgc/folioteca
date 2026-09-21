import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { MOCK_INSTALL_CODE } from '@/testing/mocks/utils';
import { screen, userEvent, waitFor } from '@/testing/test-utils';

const ORGANIZATION_NAME = 'Biblioteca Municipal de Exemplo';
const PERSON_NAME = 'Ana Souza';
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

const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  code = MOCK_INSTALL_CODE,
): Promise<void> => {
  await user.type(screen.getByLabelText('Código de instalação'), code);
  await user.type(
    screen.getByLabelText('Nome da organização'),
    ORGANIZATION_NAME,
  );
  await user.type(screen.getByLabelText('Seu nome'), PERSON_NAME);
  await user.type(screen.getByLabelText('E-mail'), EMAIL);
  // Generated at run time: never a literal that looks like a real credential.
  await user.type(screen.getByLabelText('Senha'), crypto.randomUUID());
};

test('not installed shows Instalar a Folioteca as the only h1 with the form', async () => {
  renderRoutes('/install');

  const headings = await screen.findAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Instalar a Folioteca');
  expect(
    screen.getByText(
      'Informe o código de instalação recebido na contratação e crie a organização e a sua conta de administrador.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
});

test('installing leads to the home page with the organization and the person in the sidebar', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  renderRoutes('/install');

  await screen.findByRole('heading', { level: 1, name: 'Instalar a Folioteca' });

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(ORGANIZATION_NAME)).toBeInTheDocument();
  expect(screen.getByText(PERSON_NAME)).toBeInTheDocument();
});

test('installed without session shows Instância já instalada and never mounts the form', async () => {
  seedInstalled({ signedIn: false });

  renderRoutes('/install');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instância já instalada',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Esta instância da Folioteca já foi instalada. A instalação só acontece uma vez.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText('Código de instalação'),
  ).not.toBeInTheDocument();
});

test('Ir para o início leads to the login notice', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });

  renderRoutes('/install');

  await user.click(
    await screen.findByRole('link', { name: 'Ir para o início' }),
  );

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Acesso por login em breve',
    }),
  ).toBeInTheDocument();
});

test('installed with session redirects to the home page', async () => {
  seedInstalled({ signedIn: true });

  renderRoutes('/install');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Instância já instalada' }),
  ).not.toBeInTheDocument();
});

test('a 409 swaps the form for the already installed notice', { timeout: 10_000 }, async () => {
  const user = userEvent.setup();
  // Somebody else installed the instance between the GET and this POST.
  server.use(
    http.post(`${env.API_URL}/installation`, () => {
      seedInstalled({ signedIn: false });
      return HttpResponse.json(
        { message: 'Esta instância já foi instalada.' },
        { status: 409 },
      );
    }),
  );

  renderRoutes('/install');

  await screen.findByRole('heading', { level: 1, name: 'Instalar a Folioteca' });

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instância já instalada',
    }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument(),
  );
});
