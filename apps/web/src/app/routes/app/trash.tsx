import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Lixeira"
      description="Documentos excluídos ficam aqui até serem restaurados ou apagados de vez."
    >
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        A lixeira está vazia. Os documentos que você excluir aparecem aqui.
      </p>
    </ContentLayout>
  );
}
