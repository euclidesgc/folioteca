import { Link } from 'react-router-dom';

import { Button } from '@/shared/components/button';
import { getTraceId } from '@/shared/lib/telemetry';

type FallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

export function RouteErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const traceId = getTraceId(error);

  return (
    <section role="alert" className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Não foi possível carregar esta página.</h2>
      <p className="text-sm text-muted-foreground">
        {traceId
          ? `Tente de novo. Se continuar, informe o código ${traceId} ao suporte.`
          : 'Tente de novo. Se continuar, avise o suporte.'}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={resetErrorBoundary}>Tentar de novo</Button>
        <Link to="/">Voltar ao início</Link>
      </div>
    </section>
  );
}
