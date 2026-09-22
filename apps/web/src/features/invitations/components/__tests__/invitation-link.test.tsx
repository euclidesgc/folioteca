import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { InvitationLink } from '../invitation-link';

const EMAIL = 'novo.convidado@exemplo.com.br';
// Assembled at runtime, never a literal: no credential-looking string goes
// into the repository, the same reasoning as `MOCK_PASSWORD`.
const LINK = `https://app.exemplo.org/invitations/${['mock', 'invitation', 'token', '1'].join('-')}`;

// jsdom does not implement `navigator.clipboard`, and the property is not
// writable: it is defined here, for this file only, and removed afterwards.
const defineClipboard = (writeText: (value: string) => Promise<void>) => {
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: spy },
    configurable: true,
  });
  return spy;
};

beforeEach(() => {
  defineClipboard(() => Promise.resolve());
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
});

const copyButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Copiar link' });

test('shows the full link and the one-time warning', () => {
  renderApp(<InvitationLink email={EMAIL} link={LINK} />);

  expect(
    screen.getByRole('heading', { name: `Convite criado para ${EMAIL}` }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Copie o link agora: ele aparece uma única vez e não pode ser mostrado de novo. Se perder, convide o mesmo e-mail outra vez para gerar um link novo.',
    ),
  ).toBeInTheDocument();

  const field = screen.getByLabelText('Link do convite');
  expect(field).toHaveValue(LINK);
  expect(field).toHaveAttribute('readonly');
});

test('Copiar link calls writeText with the link and publishes the success notification', async () => {
  const user = userEvent.setup();
  const writeText = defineClipboard(() => Promise.resolve());
  renderApp(<InvitationLink email={EMAIL} link={LINK} />);

  await user.click(copyButton());

  await waitFor(() => expect(writeText).toHaveBeenCalledWith(LINK));
  await waitFor(() =>
    expect(useNotifications.getState().notifications).toEqual([
      expect.objectContaining({ type: 'success', title: 'Link copiado' }),
    ]),
  );
});

test('a rejected writeText publishes the error notification and keeps the link on screen', async () => {
  const user = userEvent.setup();
  const writeText = defineClipboard(() =>
    Promise.reject(new DOMException('Denied', 'NotAllowedError')),
  );
  renderApp(<InvitationLink email={EMAIL} link={LINK} />);

  await user.click(copyButton());

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(useNotifications.getState().notifications).toEqual([
      expect.objectContaining({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione o link e copie com o teclado.',
      }),
    ]),
  );
  expect(screen.getByLabelText('Link do convite')).toHaveValue(LINK);
});

test('without navigator.clipboard it publishes the error notification and never calls writeText', async () => {
  const user = userEvent.setup();
  // This case does not define the property at all.
  Reflect.deleteProperty(navigator, 'clipboard');
  renderApp(<InvitationLink email={EMAIL} link={LINK} />);

  await user.click(copyButton());

  await waitFor(() =>
    expect(useNotifications.getState().notifications).toEqual([
      expect.objectContaining({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione o link e copie com o teclado.',
      }),
    ]),
  );
  expect(navigator.clipboard).toBeUndefined();
  expect(screen.getByLabelText('Link do convite')).toHaveValue(LINK);
});
