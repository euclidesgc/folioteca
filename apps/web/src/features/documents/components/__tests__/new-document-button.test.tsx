import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor } from '@/testing/test-utils';

import { NewDocumentButton } from '../new-document-button';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The button navigates on success: the memory router needs a real destination
// for the document address.
const renderButton = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(
    [
      { path: '/', element: <NewDocumentButton /> },
      { path: '/documents/:documentId', element: <p>Página do documento</p> },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

test('renders the Novo documento button', () => {
  renderButton();

  const button = screen.getByRole('button', { name: 'Novo documento' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toBeEnabled();
});

test('creates a document and navigates to its page', async () => {
  const user = userEvent.setup();
  const router = renderButton();

  await user.click(screen.getByRole('button', { name: 'Novo documento' }));

  expect(await screen.findByText('Página do documento')).toBeInTheDocument();
  expect(router.state.location.pathname).toMatch(/^\/documents\/.+/);
});

test('shows Criando… disabled and aria-busy while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/documents`, async () => {
      await delay(200);
      return HttpResponse.json({ message: 'Erro.' }, { status: 500 });
    }),
  );
  renderButton();

  await user.click(screen.getByRole('button', { name: 'Novo documento' }));

  const sending = await screen.findByRole('button', { name: 'Criando…' });
  expect(sending).toBeDisabled();
  expect(sending).toHaveAttribute('aria-busy', 'true');

  await screen.findByRole('button', { name: 'Novo documento' });
});

test('a double click creates a single document', async () => {
  const user = userEvent.setup();
  let requests = 0;
  server.use(
    http.post(`${env.API_URL}/documents`, async () => {
      requests += 1;
      await delay(100);
      return HttpResponse.json(
        {
          data: {
            id: 'document-novo',
            title: 'Sem título',
            spaceId: 'space-person-1',
            authorId: 'person-1',
            ownerId: 'person-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            accessLevel: 'owner',
          },
        },
        { status: 201 },
      );
    }),
  );
  renderButton();

  await user.dblClick(screen.getByRole('button', { name: 'Novo documento' }));

  expect(await screen.findByText('Página do documento')).toBeInTheDocument();
  expect(requests).toBe(1);
});

test('a failed creation stays on the page and restores the button', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/documents`, () =>
      HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 }),
    ),
  );
  const router = renderButton();

  await user.click(screen.getByRole('button', { name: 'Novo documento' }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Novo documento' })).toBeEnabled(),
  );
  expect(router.state.location.pathname).toBe('/');
  expect(screen.queryByText('Página do documento')).not.toBeInTheDocument();
});
