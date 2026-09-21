import type React from 'react';

export function MainErrorFallback(): React.JSX.Element {
  return (
    <div role="alert" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-gray-600">
        Não foi possível abrir a página. Recarregue para tentar de novo.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
      >
        Recarregar
      </button>
    </div>
  );
}
