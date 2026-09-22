import type React from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import type { useSpaces } from '@/features/unit-spaces/api/get-spaces';

// What the heading says whenever there is no unit name to show: an empty or
// changing `<h1>` would jump in value for whoever uses a screen reader.
const FALLBACK_TITLE = 'Espaço da unidade';

type UnitSpaceViewProps = {
  // The list of the signed-in person, read by whoever owns the page.
  query: ReturnType<typeof useSpaces>;
  spaceId: string;
};

// The same page frame as `ContentLayout`, for the states that have no support
// text: the state itself takes the place of the text and of the documents.
function UnitSpaceStatePage({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{FALLBACK_TITLE}</h1>
      {children}
    </main>
  );
}

export function UnitSpaceView({
  query,
  spaceId,
}: UnitSpaceViewProps): React.JSX.Element {
  // No request by id exists: the space is looked up in the list of the
  // signed-in person, so an unknown id, one of another organization, a
  // malformed one and a unit the person is not assigned to all end up in the
  // same "not found" state. The id of the URL only reaches the screen as text
  // rendered by React.
  if (!query.data) {
    // A retry after a failed load shows the loading state again.
    if (query.isPending || query.isFetching) {
      return (
        <UnitSpaceStatePage>
          <p role="status" className="mt-6 text-gray-600">
            Carregando o espaço…
          </p>
        </UnitSpaceStatePage>
      );
    }

    return (
      <UnitSpaceStatePage>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-800">Não foi possível carregar o espaço.</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      </UnitSpaceStatePage>
    );
  }

  const space = query.data.data.find((item) => item.id === spaceId);

  if (!space) {
    return (
      <UnitSpaceStatePage>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <p className="font-medium text-red-800">Espaço não encontrado.</p>
          <p className="mt-1 text-red-800">
            Ele não existe ou você não está lotado nesta unidade.
          </p>
          <p className="mt-3">
            <Link
              to={paths.home.getHref()}
              className="font-medium text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Voltar para o início
            </Link>
          </p>
        </div>
      </UnitSpaceStatePage>
    );
  }

  // `break-words` on the wrapper: `overflow-wrap` is inherited, so a long unit
  // name breaks inside the `<h1>` of `ContentLayout` instead of overflowing
  // the page on a narrow screen.
  return (
    <div className="min-w-0 break-words">
      <ContentLayout
        title={space.name}
        description="O espaço de documentos da sua unidade."
      >
        <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
          Os documentos deste espaço ainda não chegaram. Em breve você e as
          pessoas lotadas nesta unidade vão guardar e encontrar documentos aqui.
        </p>
      </ContentLayout>
    </div>
  );
}
