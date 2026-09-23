import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { useOrgUnits } from '@/features/org-units/api/get-org-units';
import { getDb, seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { SpaceAccessControl } from '../space-access-control';

const UNIT_ID = 'org-unit-catalogacao';
const PARENT_NAME = 'Acervo e Processamento Técnico';

const OWN_SENTENCE = 'Só quem está lotado em “Catalogação” vê este espaço.';
const INHERIT_SENTENCE =
  'Quem está lotado em “Catalogação” e quem vê o espaço de “Acervo e Processamento Técnico” vê este espaço.';
const FAILURE =
  'Não foi possível mudar o acesso ao espaço. Tente de novo em instantes.';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
});

// The unit comes from the list, as in the tree: after a change the list is
// reread and the control receives the new mode.
function Harness(): React.JSX.Element | null {
  const orgUnitsQuery = useOrgUnits();
  const unit = orgUnitsQuery.data?.data.find((item) => item.id === UNIT_ID);
  if (!unit) return null;

  return <SpaceAccessControl unit={unit} parentName={PARENT_NAME} />;
}

const ownOption = (): HTMLElement =>
  screen.getByRole('radio', { name: 'Permissões próprias' });

const inheritOption = (): HTMLElement =>
  screen.getByRole('radio', { name: 'Herda da unidade-pai' });

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const storedAccess = (): string | undefined =>
  getDb().orgUnits.find((item) => item.id === UNIT_ID)?.spaceAccess;

test('checks the option of the current access mode and shows its sentence', async () => {
  renderApp(<Harness />);

  expect(
    await screen.findByRole('group', { name: 'Modo de acesso' }),
  ).toBeInTheDocument();
  expect(ownOption()).toBeChecked();
  expect(inheritOption()).not.toBeChecked();
  expect(screen.getByText(OWN_SENTENCE)).toBeInTheDocument();
});

test('choosing Herda da unidade-pai sends inherit', async () => {
  const user = userEvent.setup();

  renderApp(<Harness />);

  await user.click(
    await screen.findByRole('radio', { name: 'Herda da unidade-pai' }),
  );

  await waitFor(() => expect(storedAccess()).toBe('inherit'));
  await waitFor(() =>
    expect(notificationTitles()).toContain('Acesso ao espaço atualizado'),
  );
  expect(inheritOption()).toBeChecked();
  expect(await screen.findByText(INHERIT_SENTENCE)).toBeInTheDocument();
});

test('disables the options and shows Salvando while sending', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId/space`, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  );

  renderApp(<Harness />);

  await user.click(
    await screen.findByRole('radio', { name: 'Herda da unidade-pai' }),
  );

  await waitFor(() => expect(inheritOption()).toBeDisabled());
  expect(ownOption()).toBeDisabled();
  expect(inheritOption()).toBeChecked();
  expect(
    screen.getByText(`${INHERIT_SENTENCE} Salvando…`),
  ).toBeInTheDocument();
});

test('a failure restores the previous option and shows the alert', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId/space`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<Harness />);

  await user.click(
    await screen.findByRole('radio', { name: 'Herda da unidade-pai' }),
  );

  expect(await screen.findByRole('alert')).toHaveTextContent(FAILURE);
  expect(ownOption()).toBeChecked();
  expect(inheritOption()).not.toBeChecked();
  expect(ownOption()).toBeEnabled();
  expect(screen.getByText(OWN_SENTENCE)).toBeInTheDocument();
  expect(storedAccess()).toBe('own');
});

test('arrow keys move between the options', async () => {
  const user = userEvent.setup();

  renderApp(<Harness />);

  await screen.findByRole('radio', { name: 'Permissões próprias' });
  await user.tab();
  expect(ownOption()).toHaveFocus();

  await user.keyboard('{ArrowDown}');

  expect(inheritOption()).toHaveFocus();
  await waitFor(() => expect(storedAccess()).toBe('inherit'));
  await waitFor(() => expect(inheritOption()).toBeEnabled());
  expect(inheritOption()).toBeChecked();
});

test('choosing the checked option sends nothing', async () => {
  const user = userEvent.setup();
  let patchCalls = 0;
  server.use(
    http.patch(`${env.API_URL}/org-units/:orgUnitId/space`, () => {
      patchCalls += 1;
      return HttpResponse.json({});
    }),
  );

  renderApp(<Harness />);

  await user.click(
    await screen.findByRole('radio', { name: 'Permissões próprias' }),
  );

  expect(ownOption()).toBeChecked();
  expect(ownOption()).toBeEnabled();
  expect(screen.getByText(OWN_SENTENCE)).toBeInTheDocument();
  expect(patchCalls).toBe(0);
});
