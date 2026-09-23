import type React from 'react';
import { useId, useRef } from 'react';

import { Button } from '@/components/ui/button/button';
import { useNotifications } from '@/components/ui/notifications/notifications-store';

type InvitationLinkProps = {
  email: string;
  link: string;
};

// The "Segredo mostrado uma única vez" recipe of docs/design.md: the link is
// in the DOM of this block only, and goes away with it — it is never put back
// on screen.
export function InvitationLink({
  email,
  link,
}: InvitationLinkProps): React.JSX.Element {
  const titleId = useId();
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const addNotification = useNotifications((state) => state.addNotification);

  const copyLink = async (): Promise<void> => {
    // Selected first, so copying by keyboard is a Ctrl+C whenever the
    // clipboard is missing or refuses.
    fieldRef.current?.select();

    const failed = (): void => {
      // The instruction is to copy by keyboard, so the focus has to be on the
      // selected text, not left behind on the button.
      fieldRef.current?.focus();
      fieldRef.current?.select();
      addNotification({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione o link e copie com o teclado.',
      });
    };

    // No clipboard at all (insecure context, old browser) and a refused write
    // (permission denied) take the same path.
    if (typeof navigator.clipboard?.writeText !== 'function') {
      failed();
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      addNotification({ type: 'success', title: 'Link copiado' });
    } catch {
      failed();
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4"
    >
      <h2 id={titleId} className="text-sm font-medium text-amber-900">
        Convite criado para {email}
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Copie o link agora: ele aparece uma única vez e não pode ser mostrado de
        novo. Se perder, convide o mesmo e-mail outra vez para gerar um link
        novo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label
          htmlFor={fieldId}
          className="w-full text-sm font-medium text-gray-900"
        >
          Link do convite
        </label>
        <input
          id={fieldId}
          ref={fieldRef}
          readOnly
          value={link}
          className="block h-10 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 font-mono text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void copyLink();
          }}
        >
          Copiar link
        </Button>
      </div>
    </section>
  );
}
