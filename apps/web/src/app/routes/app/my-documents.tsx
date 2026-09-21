import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';
import { DocumentsList } from '@/features/documents/components/documents-list';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Meus documentos"
      description="Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados."
    >
      <DocumentsList />
    </ContentLayout>
  );
}
