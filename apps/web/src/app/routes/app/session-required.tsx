import type React from 'react';

// Stands in for the whole app while there is no login screen yet.
export function SessionRequired(): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Acesso por login em breve</h1>
      <p className="mt-2 text-gray-600">
        Esta instância já está instalada. A tela de login chega em breve; por
        enquanto, só quem fez a instalação neste navegador continua com acesso.
      </p>
    </main>
  );
}
