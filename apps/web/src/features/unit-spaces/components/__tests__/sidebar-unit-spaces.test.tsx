import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { useSpaces } from '@/features/unit-spaces/api/get-spaces';
import {
  addAssignment,
  listSpacesOf,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, within } from '@/testing/test-utils';

import { SidebarUnitSpaces } from '../sidebar-unit-spaces';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

// Reads the same cache as the section and says when the list has arrived, so
// "nothing on screen" is asserted after the answer and not before it.
function SpacesArrived(): React.JSX.Element | null {
  const query = useSpaces();
  return query.isSuccess ? <p>Lista recebida</p> : null;
}

test('renders nothing while loading', async () => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/spaces`, async () => {
      await released;
      return HttpResponse.json({
        data: [
          { id: 'space-org-unit-catalogacao', type: 'unit', name: 'Catalogação' },
        ],
      });
    }),
  );

  const { container } = renderApp(<SidebarUnitSpaces />);

  expect(container).toBeEmptyDOMElement();
  expect(
    screen.queryByRole('navigation', { name: 'Unidades' }),
  ).not.toBeInTheDocument();

  release();

  expect(
    await screen.findByRole('link', { name: 'Catalogação' }, LAZY_TIMEOUT),
  ).toBeInTheDocument();
});

test('renders nothing when the person has no unit spaces', async () => {
  renderApp(
    <>
      <SidebarUnitSpaces />
      <SpacesArrived />
    </>,
  );

  await screen.findByText('Lista recebida', {}, LAZY_TIMEOUT);

  expect(
    screen.queryByRole('navigation', { name: 'Unidades' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Unidades')).not.toBeInTheDocument();
});

test('renders one link per space in the received order', async () => {
  addAssignment('org-unit-sala-infantil', INSTALLED_PERSON_ID);
  addAssignment('org-unit-acervo', INSTALLED_PERSON_ID);
  addAssignment('org-unit-administrativa', INSTALLED_PERSON_ID);
  // The order the handler answers with (pt-BR collation, accents ignored).
  const answered = listSpacesOf(INSTALLED_PERSON_ID).map((space) => space.name);
  expect(answered).toEqual([
    'Acervo e Processamento Técnico',
    'Área Administrativa',
    'Sala Infantil',
  ]);

  renderApp(<SidebarUnitSpaces />);

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Unidades' },
    LAZY_TIMEOUT,
  );
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Unidades' }),
  ).toBeInTheDocument();
  const links = within(nav).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual(answered);
  expect(links.map((link) => link.getAttribute('title'))).toEqual(answered);
});

test('each link points to the unit space href', async () => {
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
  addAssignment('org-unit-emprestimos', INSTALLED_PERSON_ID);

  renderApp(<SidebarUnitSpaces />);

  expect(
    await screen.findByRole('link', { name: 'Catalogação' }, LAZY_TIMEOUT),
  ).toHaveAttribute(
    'href',
    paths.unitSpace.getHref('space-org-unit-catalogacao'),
  );
  expect(
    screen.getByRole('link', { name: 'Empréstimos e Devoluções' }),
  ).toHaveAttribute(
    'href',
    paths.unitSpace.getHref('space-org-unit-emprestimos'),
  );
});

test('on error shows the message and Tentar novamente refetches', async () => {
  const user = userEvent.setup();
  addAssignment('org-unit-catalogacao', INSTALLED_PERSON_ID);
  let calls = 0;
  server.use(
    http.get(
      `${env.API_URL}/spaces`,
      () => {
        calls += 1;
        return HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        );
      },
      { once: true },
    ),
  );

  renderApp(<SidebarUnitSpaces />);

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Unidades' },
    LAZY_TIMEOUT,
  );
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Unidades' }),
  ).toBeInTheDocument();
  const alert = within(nav).getByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar suas unidades.');
  expect(calls).toBe(1);

  let retried = 0;
  server.use(
    http.get(`${env.API_URL}/spaces`, () => {
      retried += 1;
      return HttpResponse.json({ data: listSpacesOf(INSTALLED_PERSON_ID) });
    }),
  );

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByRole('link', { name: 'Catalogação' }, LAZY_TIMEOUT),
  ).toBeInTheDocument();
  expect(retried).toBe(1);
});
