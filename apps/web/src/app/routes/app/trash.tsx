import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';
import { DocumentsList } from '@/features/documents/components/documents-list';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Lixeira"
      description="Documentos excluídos ficam aqui até serem restaurados ou apagados de vez."
    >
      <DocumentsList scope="trash" />
    </ContentLayout>
  );
}
