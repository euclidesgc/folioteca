import type React from 'react';

export function HydrateFallback(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <p role="status" className="mt-6 text-gray-600">
        Carregando…
      </p>
    </main>
  );
}
