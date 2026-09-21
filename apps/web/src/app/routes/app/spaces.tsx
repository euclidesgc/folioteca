import type React from 'react';

import { ContentLayout } from '@/components/layouts/content-layout';

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Espaços"
      description="Espaços reúnem os documentos de uma equipe ou de um assunto."
    >
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Nenhum espaço ainda. Os espaços de que você participa aparecem aqui.
      </p>
    </ContentLayout>
  );
}
