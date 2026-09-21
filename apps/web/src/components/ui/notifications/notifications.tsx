import type React from 'react';
import { useEffect } from 'react';

import { cn } from '@/utils/cn';

import { Button } from '@/components/ui/button/button';
import {
  type Notification,
  useNotifications,
} from './notifications-store';

const AUTO_DISMISS_MS = 6_000;

const borderByType: Record<Notification['type'], string> = {
  error: 'border-red-200',
  success: 'border-green-200',
  warning: 'border-amber-200',
  info: 'border-gray-200',
};

type NotificationItemProps = {
  notification: Notification;
  onDismiss: (id: string) => void;
};

const NotificationItem = ({
  notification,
  onDismiss,
}: NotificationItemProps): React.JSX.Element => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDismiss(notification.id);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div
      role={notification.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border bg-white p-4 shadow-lg',
        borderByType[notification.type],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {notification.title}
          </p>
          {notification.message ? (
            <p className="mt-1 text-sm text-gray-600">
              {notification.message}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onDismiss(notification.id)}
          className="h-8 border-none px-2 text-gray-600 hover:bg-transparent hover:text-gray-900"
        >
          Fechar
        </Button>
      </div>
    </div>
  );
};

export function Notifications(): React.JSX.Element {
  const notifications = useNotifications((state) => state.notifications);
  const dismissNotification = useNotifications(
    (state) => state.dismissNotification,
  );

  if (notifications.length === 0) return <></>;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
}
