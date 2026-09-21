import type React from 'react';

import { useHealth } from '@/features/connection/api/get-health';

export function ConnectionIndicator(): React.JSX.Element {
  const health = useHealth();

  if (health.isPending) {
    return (
      <p role="status" className="text-sm text-gray-600">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
          Conectando…
        </span>
      </p>
    );
  }

  if (health.isError) {
    return (
      <div role="alert">
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-800">
          Sem conexão
        </span>
        <p className="mt-2 text-sm text-gray-600">Tentando reconectar…</p>
      </div>
    );
  }

  return (
    <p role="status" className="text-sm text-gray-600">
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-sm text-green-800">
        Conectado
      </span>
    </p>
  );
}
