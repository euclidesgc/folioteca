import type React from 'react';
import { Link } from 'react-router';

import { paths } from '@/config/paths';

export function NotFound(): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-gray-600">
        O endereço que você abriu não existe ou foi movido.
      </p>
      <Link
        replace
        to={paths.home.getHref()}
        className="mt-6 inline-block font-medium text-blue-600 underline-offset-4 hover:underline"
      >
        Voltar para o início
      </Link>
    </main>
  );
}
