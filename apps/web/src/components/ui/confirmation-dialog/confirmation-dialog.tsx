import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type React from 'react';

import { Button } from '@/components/ui/button/button';

export type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional: without a trigger the dialog is opened only by `open`, which is
  // what a single dialog shared by a whole list or tree needs. Without a
  // trigger Radix has nowhere to give the focus back to when the dialog
  // closes, so whoever opens it this way owns the focus on closing, through
  // `onCloseAutoFocus` below.
  trigger?: React.ReactNode;
  onCloseAutoFocus?: React.ComponentProps<
    typeof AlertDialogPrimitive.Content
  >['onCloseAutoFocus'];
  title: string;
  description: React.ReactNode;
  // A `Button` placed here, not the primitive's own action: the primitive's
  // action closes the dialog on click, which would hide a pending or a
  // failed mutation. This slot stays a plain button — the caller decides
  // when to close, through `onOpenChange(false)`, once the mutation settles.
  confirmButton: React.ReactNode;
  cancelLabel?: string;
};

export const ConfirmationDialog = ({
  open,
  onOpenChange,
  trigger,
  onCloseAutoFocus,
  title,
  description,
  confirmButton,
  cancelLabel = 'Cancelar',
}: ConfirmationDialogProps): React.JSX.Element => (
  <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    {trigger ? (
      <AlertDialogPrimitive.Trigger asChild>
        {trigger}
      </AlertDialogPrimitive.Trigger>
    ) : null}
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <AlertDialogPrimitive.Content
        onCloseAutoFocus={onCloseAutoFocus}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-lg"
      >
        <AlertDialogPrimitive.Title className="text-lg font-semibold text-gray-900">
          {title}
        </AlertDialogPrimitive.Title>
        <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-600 break-words">
          {description}
        </AlertDialogPrimitive.Description>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <AlertDialogPrimitive.Cancel asChild>
            <Button variant="secondary">{cancelLabel}</Button>
          </AlertDialogPrimitive.Cancel>
          {confirmButton}
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  </AlertDialogPrimitive.Root>
);
