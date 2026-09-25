import type React from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useCreateDocument } from '@/features/documents/api/create-document';

type NewDocumentButtonProps = {
  // Creates the document in this space; without it, in the personal space.
  spaceId?: string;
  className?: string;
};

export function NewDocumentButton({
  spaceId,
  className = 'w-full',
}: NewDocumentButtonProps = {}): React.JSX.Element {
  const navigate = useNavigate();
  const createDocumentMutation = useCreateDocument({
    mutationConfig: {
      onSuccess: (response) => {
        void navigate(paths.document.getHref(response.data.id));
      },
      // no onError: the api client already notified, and the page stays as it is
    },
  });

  return (
    <Button
      type="button"
      className={className}
      isLoading={createDocumentMutation.isPending}
      onClick={() => {
        // A second click can arrive before the button re-renders as disabled.
        if (createDocumentMutation.isPending) return;

        createDocumentMutation.mutate(
          spaceId === undefined ? undefined : { spaceId },
        );
      }}
    >
      {createDocumentMutation.isPending ? 'Criando…' : 'Novo documento'}
    </Button>
  );
}
