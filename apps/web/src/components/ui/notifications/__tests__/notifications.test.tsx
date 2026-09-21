import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { Notifications } from '../notifications';
import {
  type Notification,
  useNotifications,
} from '../notifications-store';

afterEach(() => {
  vi.useRealTimers();
});

const add = (notification: Omit<Notification, 'id'>): void => {
  act(() => {
    useNotifications.getState().addNotification(notification);
  });
};

test('renders an error notification with role alert', () => {
  render(<Notifications />);

  add({ type: 'error', title: 'Algo deu errado' });

  expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado');
});

test('renders a success notification with role status', () => {
  render(<Notifications />);

  add({ type: 'success', title: 'Instalação concluída' });

  expect(screen.getByRole('status')).toHaveTextContent('Instalação concluída');
});

test('renders the optional message', () => {
  render(<Notifications />);

  add({
    type: 'error',
    title: 'Algo deu errado',
    message: 'Não foi possível concluir a operação. Tente novamente em instantes.',
  });

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Não foi possível concluir a operação. Tente novamente em instantes.',
  );
});

test('Fechar removes the notification', async () => {
  const user = userEvent.setup();
  render(<Notifications />);

  add({ type: 'success', title: 'Instalação concluída' });

  await user.click(screen.getByRole('button', { name: 'Fechar' }));

  expect(screen.queryByText('Instalação concluída')).not.toBeInTheDocument();
});

test('removes the notification on its own after 6 seconds', () => {
  vi.useFakeTimers();
  render(<Notifications />);

  add({ type: 'success', title: 'Instalação concluída' });
  expect(screen.getByText('Instalação concluída')).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(6_000);
  });

  expect(screen.queryByText('Instalação concluída')).not.toBeInTheDocument();
});

test('renders nothing when the list is empty', () => {
  const { container } = render(<Notifications />);

  expect(container).toBeEmptyDOMElement();
});
