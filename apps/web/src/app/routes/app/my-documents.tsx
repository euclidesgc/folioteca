import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Meus documentos"
      description="Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados."
    >
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Nenhum documento ainda. Os documentos que você criar aparecem aqui.
      </p>
    </ContentLayout>
  );
}
