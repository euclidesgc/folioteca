import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';
import type { CurrentUserResponse } from '@/types/api';

import { LoginForm } from '../login-form';

const EMAIL = 'ana.souza@exemplo.com.br';

const CURRENT_USER: CurrentUserResponse = {
  data: {
    organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
    person: {
      id: 'person-1',
      name: 'Ana Souza',
      email: EMAIL,
      isAdmin: true,
      documentPageWidth: 'medium',
    },
  },
};

const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  { email = EMAIL, password = MOCK_PASSWORD } = {},
): Promise<void> => {
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
};

const notifications = () => useNotifications.getState().notifications;

test('renders the E-mail and Senha fields and the Entrar button', () => {
  renderApp(<LoginForm />);

  expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute(
    'type',
    'submit',
  );
});

test('uses autocomplete username and current-password', () => {
  renderApp(<LoginForm />);

  expect(screen.getByLabelText('E-mail')).toHaveAttribute(
    'autocomplete',
    'username',
  );
  expect(screen.getByLabelText('Senha')).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
});

test('submits the email in lowercase', async () => {
  const user = userEvent.setup();
  const received = vi.fn();
  server.use(
    http.post(`${env.API_URL}/auth/login`, async ({ request }) => {
      received(await request.json());
      return HttpResponse.json(CURRENT_USER);
    }),
  );
  renderApp(<LoginForm />);

  await fillForm(user, { email: 'Ana.Souza@Exemplo.COM.BR' });
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() =>
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL }),
    ),
  );
});

test('empty submit shows the messages and focuses the email field', async () => {
  const user = userEvent.setup();
  renderApp(<LoginForm />);

  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
  expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByLabelText('E-mail'));
});

test('an invalid email does not send the request', async () => {
  const user = userEvent.setup();
  const requests = vi.fn();
  server.use(
    http.post(`${env.API_URL}/auth/login`, () => {
      requests();
      return HttpResponse.json(CURRENT_USER);
    }),
  );
  renderApp(<LoginForm />);

  await fillForm(user, { email: 'ana.souza' });
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(
    await screen.findByText('Informe um e-mail válido.'),
  ).toBeInTheDocument();
  expect(requests).not.toHaveBeenCalled();
});

test('button shows Entrando… disabled and aria-busy while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/auth/login`, async () => {
      await delay(200);
      return HttpResponse.json(CURRENT_USER);
    }),
  );
  renderApp(<LoginForm />);

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  const button = await screen.findByRole('button', { name: 'Entrando…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');

  await screen.findByRole('button', { name: 'Entrar' });
});

test('shows E-mail ou senha incorretos. on 401 and keeps the typed values', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });
  renderApp(<LoginForm />);

  await fillForm(user, { password: 'senha-que-nao-confere' });
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'E-mail ou senha incorretos.',
  );
  expect(screen.getByLabelText('E-mail')).toHaveValue(EMAIL);
  expect(screen.getByLabelText('Senha')).toHaveValue('senha-que-nao-confere');
});

test('shows the failure alert on 500', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/auth/login`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );
  renderApp(<LoginForm />);

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível entrar. Tente de novo em instantes.',
  );
});

test('clears the alert on the next submit', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });
  renderApp(<LoginForm />);

  await fillForm(user, { password: 'senha-que-nao-confere' });
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('alert');

  await user.clear(screen.getByLabelText('Senha'));
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
});

test('never adds a global notification', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: false });
  renderApp(<LoginForm />);

  await fillForm(user, { password: 'senha-que-nao-confere' });
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByRole('alert');

  await user.clear(screen.getByLabelText('Senha'));
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));

  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
  expect(notifications()).toHaveLength(0);
});
