import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Favoritos"
      description="Os documentos que você marca como favoritos ficam à mão aqui."
    >
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Nenhum favorito ainda. Quando você marcar um documento como favorito,
        ele aparece aqui.
      </p>
    </ContentLayout>
  );
}
