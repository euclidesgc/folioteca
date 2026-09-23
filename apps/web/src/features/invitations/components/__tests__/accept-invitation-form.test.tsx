import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import {
  getDb,
  type MockInvitation,
  seedInstalled,
  seedSampleInvitations,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';

import { AcceptInvitationForm } from '../accept-invitation-form';

beforeEach(() => {
  // Whoever opens an invitation link has no account and no session yet.
  seedInstalled({ signedIn: false });
  seedSampleInvitations();
});

const seededInvitation = (): MockInvitation => {
  const invitation = getDb().invitations[0];
  if (!invitation) throw new Error('The sample invitation was not seeded');
  return invitation;
};

const renderForm = ({
  onSuccess = vi.fn(),
  onExpired = vi.fn(),
  token = seededInvitation().token,
}: {
  onSuccess?: () => void;
  onExpired?: () => void;
  token?: string;
} = {}): { onSuccess: () => void; onExpired: () => void } => {
  renderApp(
    <AcceptInvitationForm
      token={token}
      email="convidado@exemplo.com.br"
      organizationName="Biblioteca Municipal de Exemplo"
      onSuccess={onSuccess}
      onExpired={onExpired}
    />,
  );

  return { onSuccess, onExpired };
};

const submitButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Criar conta' });

test('the name and password labels are associated with their fields', () => {
  renderForm();

  expect(screen.getByLabelText('Seu nome')).toHaveAttribute('type', 'text');
  const password = screen.getByLabelText('Senha');
  expect(password).toHaveAttribute('type', 'password');
  expect(password).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByText('Mínimo de 12 caracteres.')).toBeInTheDocument();
});

test('there is no e-mail field on the screen', () => {
  renderForm();

  expect(screen.queryByLabelText(/e-mail/i)).toBeNull();
  expect(screen.getByText('convidado@exemplo.com.br')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Criar sua conta na Biblioteca Municipal de Exemplo',
    }),
  ).toBeInTheDocument();
});

test('submitting empty shows both required messages without calling the API', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, () => {
      calls += 1;
      return HttpResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    }),
  );
  renderForm();

  await user.click(submitButton());

  expect(await screen.findByText('Informe o seu nome.')).toBeInTheDocument();
  expect(
    screen.getByText('A senha precisa ter pelo menos 12 caracteres.'),
  ).toBeInTheDocument();
  expect(calls).toBe(0);
});

test('a password with eleven characters is refused on the client', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, () => {
      calls += 1;
      return HttpResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    }),
  );
  renderForm();

  await user.type(screen.getByLabelText('Seu nome'), 'Carlos Lima');
  await user.type(screen.getByLabelText('Senha'), 'x'.repeat(11));
  await user.click(submitButton());

  expect(
    await screen.findByText('A senha precisa ter pelo menos 12 caracteres.'),
  ).toBeInTheDocument();
  expect(calls).toBe(0);
});

test('on success it calls onSuccess', async () => {
  const user = userEvent.setup();
  const { onSuccess } = renderForm();

  await user.type(screen.getByLabelText('Seu nome'), 'Carlos Lima');
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(submitButton());

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
});

test('a 409 shows the alert with the link to the sign-in screen', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, () =>
      HttpResponse.json(
        { message: 'Esta pessoa já faz parte da organização.' },
        { status: 409 },
      ),
    ),
  );
  renderForm();

  await user.type(screen.getByLabelText('Seu nome'), 'Carlos Lima');
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(submitButton());

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(
    'Este e-mail já tem conta na Folioteca. Entre com ela.',
  );
  expect(
    screen.getByRole('link', { name: 'Ir para a tela de entrar' }),
  ).toHaveAttribute('href', '/login');
});

test('a 404 calls onExpired', async () => {
  const user = userEvent.setup();
  const { onExpired } = renderForm({ token: 'token-que-nao-existe' });

  await user.type(screen.getByLabelText('Seu nome'), 'Carlos Lima');
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(submitButton());

  await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
});

test('another failure shows the generic alert inside the form', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  renderForm();

  await user.type(screen.getByLabelText('Seu nome'), 'Carlos Lima');
  await user.type(screen.getByLabelText('Senha'), MOCK_PASSWORD);
  await user.click(submitButton());

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível criar a conta. Tente de novo em instantes.',
  );
});

test('pressing Enter twice sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, async () => {
      calls += 1;
      await delay(50);
      return HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      );
    }),
  );
  const { onSuccess } = renderForm();

  const name = screen.getByLabelText('Seu nome');
  await user.click(name);
  expect(name).toHaveFocus();
  await user.keyboard('Carlos Lima');
  await user.tab();
  expect(screen.getByLabelText('Senha')).toHaveFocus();
  await user.keyboard(MOCK_PASSWORD);
  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(calls).toBe(1);
  expect(onSuccess).not.toHaveBeenCalled();
});
