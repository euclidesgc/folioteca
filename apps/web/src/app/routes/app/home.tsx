import type React from 'react';
import { Link } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';

const areas = [
  {
    label: 'Favoritos',
    href: paths.favorites.getHref(),
    description: 'Os documentos que você marca para ter sempre à mão.',
  },
  {
    label: 'Meus documentos',
    href: paths.myDocuments.getHref(),
    description:
      'O que você cria, visível só para você até compartilhar.',
  },
  {
    label: 'Espaços',
    href: paths.spaces.getHref(),
    description: 'Documentos reunidos por equipe ou por assunto.',
  },
  {
    label: 'Lixeira',
    href: paths.trash.getHref(),
    description:
      'Documentos excluídos, até serem restaurados ou apagados de vez.',
  },
];

export function Component(): React.JSX.Element {
  return (
    <ContentLayout
      title="Boas-vindas à Folioteca"
      description="Aqui você escreve, organiza e compartilha os documentos da sua organização."
    >
      <h2 className="mt-8 text-lg font-semibold">
        Como a Folioteca se organiza
      </h2>
      <ul className="mt-6 divide-y divide-gray-200">
        {areas.map((area) => (
          <li key={area.href} className="py-3">
            <Link
              to={area.href}
              className="font-medium text-blue-600 underline-offset-4 hover:underline"
            >
              {area.label}
            </Link>
            <p className="mt-1 text-gray-600">{area.description}</p>
          </li>
        ))}
      </ul>
    </ContentLayout>
  );
}
