import { expect, test } from 'vitest';

import { useNotifications } from '../notifications-store';

test('adds a notification with a generated id', () => {
  useNotifications
    .getState()
    .addNotification({ type: 'success', title: 'Instalação concluída' });

  const { notifications } = useNotifications.getState();
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({
    type: 'success',
    title: 'Instalação concluída',
  });
  expect(notifications[0]?.id).toEqual(expect.any(String));
  expect(notifications[0]?.id.length).toBeGreaterThan(0);
});

test('dismisses a notification by id', () => {
  useNotifications
    .getState()
    .addNotification({ type: 'error', title: 'Algo deu errado' });
  const id = useNotifications.getState().notifications[0]?.id ?? '';

  useNotifications.getState().dismissNotification(id);

  expect(useNotifications.getState().notifications).toHaveLength(0);
});

test('keeps the other notifications when one is dismissed', () => {
  const { addNotification } = useNotifications.getState();
  addNotification({ type: 'info', title: 'Primeira' });
  addNotification({ type: 'info', title: 'Segunda' });
  const firstId = useNotifications.getState().notifications[0]?.id ?? '';

  useNotifications.getState().dismissNotification(firstId);

  expect(
    useNotifications.getState().notifications.map((item) => item.title),
  ).toEqual(['Segunda']);
});
