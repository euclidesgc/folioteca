import * as DialogPrimitive from '@radix-ui/react-dialog';
import type React from 'react';
import { createContext, useContext, useLayoutEffect, useRef } from 'react';

import { cn } from '@/utils/cn';

// Modal dialog for a form, on the Radix primitive: it traps the focus, closes
// on `Esc` and on a click outside, and returns the focus to whoever had it
// when it opened. Controlled by `open`/`onOpenChange`, so there is no trigger
// here — the caller owns when it opens.
//
// When the dialog is opened by state, Radix has no element to return the focus to when
// it closes (it always aims at its own trigger, which here is never set), and
// the focus would fall on the `body`. So the box itself remembers who had the
// focus at the moment it opened and puts it back — unless whoever opened it
// takes the focus over in `onCloseAutoFocus` with `preventDefault`.
//
// `ConfirmationDialog` stays as it is: that one is an `alertdialog`, for a
// destructive action that must not close by accident.

const DialogOpenerContext = createContext<React.RefObject<HTMLElement | null> | null>(
  null,
);

// Mounts only while the box is open, and writes down who had the focus at
// that instant. It is a layout effect, and Radix moves the focus into the box
// in an ordinary effect: this one always runs first.
const DialogOpenerKeeper = ({
  openerRef,
}: {
  openerRef: React.RefObject<HTMLElement | null>;
}): null => {
  useLayoutEffect(() => {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
  }, [openerRef]);

  return null;
};

export const Dialog = ({
  open,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element => {
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <DialogOpenerContext.Provider value={openerRef}>
      {open === true ? <DialogOpenerKeeper openerRef={openerRef} /> : null}
      <DialogPrimitive.Root open={open} {...props} />
    </DialogOpenerContext.Provider>
  );
};

export const DialogClose = DialogPrimitive.Close;

export const DialogContent = ({
  className,
  children,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>): React.JSX.Element => {
  const openerRef = useContext(DialogOpenerContext);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      {/* The remaining props of the box go through: it is by them that the
          caller receives `onOpenAutoFocus`. */}
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-lg',
          className,
        )}
        onCloseAutoFocus={(event) => {
          // The caller decides first: if it took the focus over, the box does
          // not touch it.
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;

          const opener = openerRef?.current;
          if (!opener?.isConnected) return;

          event.preventDefault();
          opener.focus();
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

export const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element => (
  <DialogPrimitive.Title
    className={cn('text-lg font-semibold text-gray-900', className)}
    {...props}
  />
);

export const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<
  typeof DialogPrimitive.Description
>): React.JSX.Element => (
  <DialogPrimitive.Description
    className={cn('mt-2 text-sm text-gray-600 break-words', className)}
    {...props}
  />
);
