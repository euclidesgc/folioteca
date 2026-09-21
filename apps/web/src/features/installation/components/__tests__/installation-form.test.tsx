import { delay, http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import { server } from '@/testing/mocks/server';
import { MOCK_INSTALL_CODE } from '@/testing/mocks/utils';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { InstallationForm } from '../installation-form';

const ORGANIZATION_NAME = 'Biblioteca Municipal de Exemplo';
const PERSON_NAME = 'Ana Souza';
const EMAIL = 'ana.souza@exemplo.com.br';
// Generated at run time: never a literal that looks like a real credential.
const validPassword = (): string => crypto.randomUUID();

const fillForm = async (
  user: ReturnType<typeof userEvent.setup>,
  { code = MOCK_INSTALL_CODE, password = validPassword() } = {},
): Promise<void> => {
  await user.type(screen.getByLabelText('Código de instalação'), code);
  await user.type(screen.getByLabelText('Nome da organização'), ORGANIZATION_NAME);
  await user.type(screen.getByLabelText('Seu nome'), PERSON_NAME);
  await user.type(screen.getByLabelText('E-mail'), EMAIL);
  await user.type(screen.getByLabelText('Senha'), password);
};

test('renders the five labelled fields and the Instalar button', () => {
  renderApp(<InstallationForm onSuccess={() => {}} />);

  expect(screen.getByLabelText('Código de instalação')).toHaveAttribute(
    'autocomplete',
    'off',
  );
  expect(screen.getByLabelText('Nome da organização')).toHaveAttribute(
    'autocomplete',
    'organization',
  );
  expect(screen.getByLabelText('Seu nome')).toHaveAttribute(
    'autocomplete',
    'name',
  );
  expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Instalar' })).toHaveAttribute(
    'type',
    'submit',
  );
});

test('shows the password hint linked to the field', () => {
  renderApp(<InstallationForm onSuccess={() => {}} />);

  const hint = screen.getByText('Mínimo de 12 caracteres.');
  expect(
    screen.getByLabelText('Senha').getAttribute('aria-describedby'),
  ).toContain(hint.id);
});

test('submits valid data and calls onSuccess', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  renderApp(<InstallationForm onSuccess={onSuccess} />);

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
});

test('shows Instalação concluída after success', async () => {
  const user = userEvent.setup();
  renderApp(
    <>
      <InstallationForm onSuccess={() => {}} />
      <Notifications />
    </>,
  );

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(await screen.findByText('Instalação concluída')).toBeInTheDocument();
});

test('empty submit shows every required message and focuses the first invalid field', async () => {
  const user = userEvent.setup();
  renderApp(<InstallationForm onSuccess={() => {}} />);

  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(
    await screen.findByText('Informe o código de instalação.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Informe o nome da organização.')).toBeInTheDocument();
  expect(screen.getByText('Informe o seu nome.')).toBeInTheDocument();
  expect(screen.getByText('Informe o e-mail.')).toBeInTheDocument();
  expect(
    screen.getByText('A senha precisa ter pelo menos 12 caracteres.'),
  ).toBeInTheDocument();

  expect(document.activeElement).toBe(
    screen.getByLabelText('Código de instalação'),
  );
});

test('an 11 character password does not send the request', async () => {
  const user = userEvent.setup();
  const onSuccess = vi.fn();
  const requests = vi.fn();
  server.use(
    http.post(`${env.API_URL}/installation`, () => {
      requests();
      return HttpResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
    }),
  );
  renderApp(<InstallationForm onSuccess={onSuccess} />);

  await fillForm(user, { password: 'x'.repeat(11) });
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(
    await screen.findByText('A senha precisa ter pelo menos 12 caracteres.'),
  ).toBeInTheDocument();
  expect(requests).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

test('button shows Instalando… disabled and aria-busy while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/installation`, async () => {
      await delay(200);
      return HttpResponse.json(
        {
          data: {
            person: {
              id: 'person-1',
              name: PERSON_NAME,
              email: EMAIL,
              isAdmin: true,
            },
            organization: { id: 'org-1', name: ORGANIZATION_NAME },
          },
        },
        { status: 201 },
      );
    }),
  );
  renderApp(<InstallationForm onSuccess={() => {}} />);

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  const button = await screen.findByRole('button', { name: 'Instalando…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');

  await screen.findByRole('button', { name: 'Instalar' });
});

test('shows the generic alert on 403 and keeps the typed values', async () => {
  const user = userEvent.setup();
  renderApp(<InstallationForm onSuccess={() => {}} />);

  await fillForm(user, { code: 'codigo-errado' });
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Instalação não concluída. Confira os dados informados e tente de novo.',
  );
  expect(screen.getByLabelText('Nome da organização')).toHaveValue(
    ORGANIZATION_NAME,
  );
  expect(screen.getByLabelText('E-mail')).toHaveValue(EMAIL);
});

test('shows the same alert on 500', async () => {
  const user = userEvent.setup();
  server.use(
    http.post(`${env.API_URL}/installation`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );
  renderApp(<InstallationForm onSuccess={() => {}} />);

  await fillForm(user);
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Instalação não concluída. Confira os dados informados e tente de novo.',
  );
});

test('clears the alert on the next submit', async () => {
  const user = userEvent.setup();
  renderApp(<InstallationForm onSuccess={() => {}} />);

  await fillForm(user, { code: 'codigo-errado' });
  await user.click(screen.getByRole('button', { name: 'Instalar' }));
  await screen.findByRole('alert');

  await user.clear(screen.getByLabelText('Código de instalação'));
  await user.type(
    screen.getByLabelText('Código de instalação'),
    MOCK_INSTALL_CODE,
  );
  await user.click(screen.getByRole('button', { name: 'Instalar' }));

  await waitFor(() =>
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
  );
});
