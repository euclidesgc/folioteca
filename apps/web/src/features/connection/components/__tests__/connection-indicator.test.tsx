import { http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, waitFor } from '@/testing/test-utils';

import { ConnectionIndicator } from '../connection-indicator';

afterEach(() => {
  vi.useRealTimers();
});

test('shows Conectando… with role status while the first request is pending', () => {
  server.use(
    http.get(`${env.API_URL}/health`, async () => {
      await new Promise(() => {});
    }),
  );

  renderApp(<ConnectionIndicator />);

  expect(screen.getByRole('status')).toHaveTextContent('Conectando…');
});

test('shows Conectado with role status when health responds 200', async () => {
  renderApp(<ConnectionIndicator />);

  expect(await screen.findByText('Conectado')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Conectado');
});

test('shows Sem conexão and Tentando reconectar… with role alert when health responds 503', async () => {
  server.use(
    http.get(`${env.API_URL}/health`, () =>
      HttpResponse.json({ message: 'Indisponível.' }, { status: 503 }),
    ),
  );

  renderApp(<ConnectionIndicator />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Sem conexão');
  expect(alert).toHaveTextContent('Tentando reconectar…');
});

test('shows Sem conexão when the request fails with a network error', async () => {
  server.use(http.get(`${env.API_URL}/health`, () => HttpResponse.error()));

  renderApp(<ConnectionIndicator />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');
});

test('goes back to Conectado on its own after a failure', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  server.use(
    http.get(
      `${env.API_URL}/health`,
      () => HttpResponse.json({ message: 'Indisponível.' }, { status: 503 }),
      { once: true },
    ),
  );

  renderApp(<ConnectionIndicator />);

  expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão');

  await vi.advanceTimersByTimeAsync(3_000);

  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Conectado'),
  );
});

test('does not render a retry button', async () => {
  renderApp(<ConnectionIndicator />);

  await screen.findByRole('status');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a failing health check never adds a notification', async () => {
  server.use(
    http.get(`${env.API_URL}/health`, () =>
      HttpResponse.json({ message: 'Indisponível.' }, { status: 503 }),
    ),
  );

  renderApp(<ConnectionIndicator />);

  await screen.findByRole('alert');

  expect(useNotifications.getState().notifications).toHaveLength(0);
});
