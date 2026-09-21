import { delay, http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import { hardRedirect } from '@/lib/hard-redirect';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { SidebarIdentity } from '../sidebar-identity';

// jsdom does not navigate: ending a session is checked by this one call.
vi.mock('@/lib/hard-redirect', () => ({ hardRedirect: vi.fn() }));

afterEach(() => {
  vi.mocked(hardRedirect).mockClear();
});

test('shows the organization name and the person name', async () => {
  seedInstalled({ signedIn: true });

  renderApp(<SidebarIdentity />);

  expect(
    await screen.findByText('Biblioteca Municipal de Exemplo'),
  ).toBeInTheDocument();
  expect(screen.getByText('Ana Souza')).toBeInTheDocument();
});

test('labels them Organização and Pessoa for screen readers', async () => {
  seedInstalled({ signedIn: true });

  renderApp(<SidebarIdentity />);

  const organizationTerm = await screen.findByText('Organização');
  expect(organizationTerm.tagName).toBe('DT');
  expect(organizationTerm).toHaveClass('sr-only');

  const personTerm = screen.getByText('Pessoa');
  expect(personTerm.tagName).toBe('DT');
  expect(personTerm).toHaveClass('sr-only');
});

test('renders nothing without a user', async () => {
  const { container } = renderApp(<SidebarIdentity />);

  await waitFor(() => expect(container).toBeEmptyDOMElement());
  expect(screen.queryByText('Organização')).not.toBeInTheDocument();
});

test('Sair posts to /auth/logout, clears the cache and redirects to /login', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: true });

  renderApp(<SidebarIdentity />);

  await user.click(await screen.findByRole('button', { name: 'Sair' }));

  await waitFor(() => expect(hardRedirect).toHaveBeenCalledWith('/login'));
  // The cleared cache refetches the session, which is over: nothing is left.
  await waitFor(() =>
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument(),
  );
});

test('button shows Saindo… disabled while sending', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: true });
  server.use(
    http.post(`${env.API_URL}/auth/logout`, async () => {
      await delay(200);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderApp(<SidebarIdentity />);

  await user.click(await screen.findByRole('button', { name: 'Sair' }));

  const button = await screen.findByRole('button', { name: 'Saindo…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');

  await waitFor(() => expect(hardRedirect).toHaveBeenCalledWith('/login'));
});

test('a failed logout does not redirect and shows the global notification', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: true });
  server.use(
    http.post(`${env.API_URL}/auth/logout`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  renderApp(
    <>
      <SidebarIdentity />
      <Notifications />
    </>,
  );

  await user.click(await screen.findByRole('button', { name: 'Sair' }));

  expect(await screen.findByText('Algo deu errado')).toBeInTheDocument();
  expect(hardRedirect).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
  expect(screen.getByText('Ana Souza')).toBeInTheDocument();
});
