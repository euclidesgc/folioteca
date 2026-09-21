import type React from 'react';
import { useParams } from 'react-router';

import { DocumentView } from '@/features/documents/components/document-view';

export function Component(): React.JSX.Element {
  const { documentId } = useParams<{ documentId: string }>();

  // The key puts a fresh title form on screen when the address changes to
  // another document.
  return <DocumentView key={documentId} documentId={documentId ?? ''} />;
}
