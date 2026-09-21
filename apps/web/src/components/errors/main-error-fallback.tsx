import type React from 'react';

import { Button } from '@/components/ui/button/button';

export function MainErrorFallback(): React.JSX.Element {
  return (
    <div role="alert" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-gray-600">
        Não foi possível abrir a página. Recarregue para tentar de novo.
      </p>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        Recarregar
      </Button>
    </div>
  );
}
