import { delay, http, HttpResponse } from 'msw';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { CreateInvitationForm } from '../create-invitation-form';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const renderForm = ({
  onSuccess = vi.fn(),
}: {
  onSuccess?: (invitation: { id: string; email: string }) => void;
} = {}): void => {
  renderApp(<CreateInvitationForm onSuccess={onSuccess} />);
};

// Assembled at runtime, never a literal: no credential-looking string goes
// into the repository, the same reasoning as `MOCK_PASSWORD`.
const fakeToken = (): string => ['mock', 'invitation', 'token', '1'].join('-');

const submitButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Criar convite' });

test('the E-mail label is associated with the field', () => {
  renderForm();

  const field = screen.getByLabelText('E-mail');
  expect(field).toHaveAttribute('type', 'email');
  expect(
    screen.getByText('A pessoa escolhe o nome e a senha ao criar a conta.'),
  ).toBeInTheDocument();
});

test('submitting empty shows the required message without calling the API', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations`, () => {
      calls += 1;
      return HttpResponse.json({ message: 'Erro interno do servidor.' }, {
        status: 500,
      });
    }),
  );
  renderForm();

  await user.click(submitButton());

  expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
  expect(screen.getByLabelText('E-mail')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(calls).toBe(0);
});

test('an invalid e-mail shows the format message', async () => {
  const user = userEvent.setup();
  renderForm();

  await user.type(screen.getByLabelText('E-mail'), 'nao-e-um-email');
  await user.click(submitButton());

  expect(
    await screen.findByText('Informe um e-mail válido.'),
  ).toBeInTheDocument();
});

test('on success it calls onSuccess with the invitation and clears the field', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  const field = screen.getByLabelText('E-mail');
  await user.type(field, 'novo.convidado@exemplo.com.br');
  await user.click(submitButton());

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'novo.convidado@exemplo.com.br' }),
  );
  await waitFor(() => expect(field).toHaveValue(''));
});

test('a 409 from the server becomes a field error with focus and keeps what was typed', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  const field = screen.getByLabelText('E-mail');
  // The e-mail of the installed person.
  await user.type(field, 'ana.souza@exemplo.com.br');
  await user.click(submitButton());

  expect(
    await screen.findByText('Esta pessoa já faz parte da organização.'),
  ).toBeInTheDocument();
  expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(field).toHaveValue('ana.souza@exemplo.com.br');
  expect(field).toHaveFocus();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('a 500 shows the alert inside the form', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/invitations`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  renderForm();

  await user.type(
    screen.getByLabelText('E-mail'),
    'novo.convidado@exemplo.com.br',
  );
  await user.click(submitButton());

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível criar o convite. Tente de novo em instantes.',
  );
});

test('pressing Enter twice sends a single request', async () => {
  const user = userEvent.setup();
  let calls = 0;
  server.use(
    http.post(`${env.API_URL}/invitations`, async () => {
      calls += 1;
      await delay(100);
      return HttpResponse.json(
        {
          data: {
            id: 'invitation-1',
            email: 'novo.convidado@exemplo.com.br',
            createdAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            token: fakeToken(),
          },
        },
        { status: 201 },
      );
    }),
  );
  const onSuccess = vi.fn();
  renderForm({ onSuccess });

  await user.type(
    screen.getByLabelText('E-mail'),
    'novo.convidado@exemplo.com.br',
  );
  await user.keyboard('{Enter}');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(calls).toBe(1);
});
