import type React from 'react';

import { Button } from '@/components/ui/button/button';
import { useUpdateFavorite } from '@/features/documents/api/update-favorite';
import type { Document } from '@/types/api';
import { cn } from '@/utils/cn';

// The only star of the app: inline here instead of a shared icon component,
// and with no icon library added to the bundle for a single drawing.
function StarIcon({ isFilled }: { isFilled: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={cn('size-5', isFilled && 'text-amber-600')}
      fill={isFilled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.28l-5.4 2.84 1.03-6.01L3.26 9.85l6.04-.88L12 3.5z" />
    </svg>
  );
}

export function FavoriteButton({
  document,
}: {
  document: Document;
}): React.JSX.Element {
  const updateFavorite = useUpdateFavorite();

  // No `disabled` while pending, against component-robustness §9: the state
  // flips right away, so dimming the button on every click would contradict
  // what the person just saw, and it would drop the keyboard focus. The early
  // return below is what keeps a double click from sending two requests.
  const handleClick = (): void => {
    if (updateFavorite.isPending) return;

    updateFavorite.mutate({
      documentId: document.id,
      isFavorite: !document.isFavorite,
    });
  };

  return (
    <Button
      variant="ghost"
      aria-pressed={document.isFavorite}
      onClick={handleClick}
    >
      <StarIcon isFilled={document.isFavorite} />
      {document.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    </Button>
  );
}
