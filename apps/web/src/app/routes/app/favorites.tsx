import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';
import { DocumentsList } from '@/features/documents/components/documents-list';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Favoritos"
      description="Os documentos que você marca como favoritos ficam à mão aqui."
    >
      <DocumentsList scope="favorites" />
    </ContentLayout>
  );
}
