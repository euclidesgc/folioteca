import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { useSpaces } from '@/features/unit-spaces/api/get-spaces';
import {
  addAssignment,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { UnitSpaceView } from '../unit-space-view';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const CATALOGACAO_SPACE_ID = 'space-org-unit-catalogacao';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
});

// The view receives the query from whoever owns the page, as the route does.
function View({ spaceId }: { spaceId: string }): React.JSX.Element {
  const query = useSpaces();
  return <UnitSpaceView query={query} spaceId={spaceId} />;
}

test('shows the loading status with the stable heading', async () => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces`, async () => {
      await released;
      return HttpResponse.json({
        data: [{ id: CATALOGACAO_SPACE_ID, type: 'unit', name: 'Catalogação' }],
      });
    }),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(screen.getByRole('status')).toHaveTextContent('Carregando o espaço…');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Espaço da unidade',
  );

  release();

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('shows the error alert and retries', async () => {
  const user = userEvent.setup();
  server.use(
    http.get(
      `${env.API_URL}/spaces`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Não foi possível carregar o espaço.');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Espaço da unidade',
  );

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows Espaço não encontrado with a link to the home page when the id is not in the list', async () => {
  renderApp(<View spaceId="space-que-nao-existe" />);

  const alert = await screen.findByRole('alert', {}, LAZY_TIMEOUT);
  expect(alert).toHaveTextContent('Espaço não encontrado.');
  expect(alert).toHaveTextContent(
    'Ele não existe ou você não está lotado nesta unidade.',
  );
  expect(
    within(alert).getByRole('link', { name: 'Voltar para o início' }),
  ).toHaveAttribute('href', paths.home.getHref());
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Espaço da unidade',
  );
});

test('shows the unit name in the heading and the documents notice when found', async () => {
  renderApp(<View spaceId={CATALOGACAO_SPACE_ID} />);

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Catalogação' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(
    screen.getByText('O espaço de documentos da sua unidade.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Os documentos deste espaço ainda não chegaram. Em breve você e as pessoas lotadas nesta unidade vão guardar e encontrar documentos aqui.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
