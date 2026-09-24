import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { useSpace } from '@/features/spaces/api/get-space';
import {
  addFreeSpace,
  getDb,
  seedInstalled,
  type MockSpace,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { SpaceInviteModeControl } from '../space-invite-mode-control';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const SPACE_URL = `${env.API_URL}/spaces/:spaceId`;

const SENTENCE =
  'Quando aberto, qualquer membro pode adicionar pessoas; só você remove.';
const FAILURE =
  'Não foi possível mudar quem adiciona pessoas. Tente de novo em instantes.';

let spaceId = '';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  spaceId = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura').id;
});

// The mode comes from the space the page reads, as in `SpaceView`: after a
// change the space is reread and the control receives the new mode.
function Harness(): React.JSX.Element | null {
  const spaceQuery = useSpace({ spaceId });
  const space = spaceQuery.data?.data;
  if (!space) return null;

  return (
    <SpaceInviteModeControl
      spaceId={spaceId}
      membersCanInvite={space.membersCanInvite}
    />
  );
}

const closedOption = (): HTMLElement =>
  screen.getByRole('radio', { name: 'Só eu adiciono pessoas' });

const openOption = (): HTMLElement =>
  screen.getByRole('radio', { name: 'Qualquer membro adiciona pessoas' });

const findClosedOption = (): Promise<HTMLElement> =>
  screen.findByRole(
    'radio',
    { name: 'Só eu adiciono pessoas' },
    LAZY_TIMEOUT,
  );

const notificationTitles = (): string[] =>
  useNotifications.getState().notifications.map((item) => item.title);

const storedMembersCanInvite = (): boolean | undefined => {
  const space: MockSpace | undefined = getDb().spaces.find(
    (item) => item.id === spaceId,
  );
  return space?.type === 'free' ? space.membersCanInvite : undefined;
};

const holdPatch = (): void => {
  server.use(
    http.patch(SPACE_URL, async () => {
      await delay('infinite');
      return HttpResponse.json({});
    }),
  );
};

test('checks Só eu adiciono pessoas when closed and shows the sentence', async () => {
  renderApp(<Harness />);

  expect(
    await screen.findByRole(
      'group',
      { name: 'Quem adiciona pessoas' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(closedOption()).toBeChecked();
  expect(openOption()).not.toBeChecked();
  expect(screen.getByText(SENTENCE)).toHaveAttribute('aria-live', 'polite');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('choosing Qualquer membro adiciona pessoas sends true', async () => {
  const user = userEvent.setup();
  const bodies: unknown[] = [];
  server.use(
    http.patch(SPACE_URL, async ({ request }) => {
      bodies.push(await request.clone().json());
      return undefined;
    }),
  );

  renderApp(<Harness />);

  await findClosedOption();
  await user.click(openOption());

  await waitFor(() => expect(storedMembersCanInvite()).toBe(true), LAZY_TIMEOUT);
  expect(bodies).toEqual([{ membersCanInvite: true }]);
  await waitFor(
    () => expect(openOption()).toHaveAttribute('aria-disabled', 'false'),
    LAZY_TIMEOUT,
  );
  expect(openOption()).toBeChecked();
  expect(closedOption()).not.toBeChecked();
});

test('marks the options aria-disabled and shows Salvando while sending', async () => {
  const user = userEvent.setup();
  holdPatch();

  renderApp(<Harness />);

  await findClosedOption();
  await user.click(openOption());

  await waitFor(() =>
    expect(openOption()).toHaveAttribute('aria-disabled', 'true'),
  );
  expect(closedOption()).toHaveAttribute('aria-disabled', 'true');
  expect(openOption()).not.toBeDisabled();
  expect(closedOption()).not.toBeDisabled();
  expect(openOption()).toBeChecked();
  expect(screen.getByText(`${SENTENCE} Salvando…`)).toBeInTheDocument();
});

test('keeps focus on the chosen option while sending', async () => {
  const user = userEvent.setup();
  holdPatch();

  renderApp(<Harness />);

  await findClosedOption();
  await user.click(openOption());

  await waitFor(() =>
    expect(openOption()).toHaveAttribute('aria-disabled', 'true'),
  );
  expect(openOption()).toHaveFocus();
  expect(openOption()).toBeChecked();

  // A choice made while sending is ignored.
  await user.click(closedOption());

  expect(openOption()).toBeChecked();
  expect(screen.getByText(`${SENTENCE} Salvando…`)).toBeInTheDocument();
});

test('a failure restores the previous option and shows the alert', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(SPACE_URL, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<Harness />);

  await findClosedOption();
  await user.click(openOption());

  expect(await screen.findByRole('alert', {}, LAZY_TIMEOUT)).toHaveTextContent(
    FAILURE,
  );
  expect(closedOption()).toBeChecked();
  expect(openOption()).not.toBeChecked();
  expect(closedOption()).toHaveAttribute('aria-disabled', 'false');
  expect(screen.getByText(SENTENCE)).toBeInTheDocument();
  expect(storedMembersCanInvite()).toBe(false);
  expect(notificationTitles()).not.toContain('Modo de convite atualizado');
});

test('a success shows Modo de convite atualizado', async () => {
  const user = userEvent.setup();

  renderApp(<Harness />);

  await findClosedOption();
  await user.click(openOption());

  await waitFor(
    () => expect(notificationTitles()).toContain('Modo de convite atualizado'),
    LAZY_TIMEOUT,
  );
  expect(openOption()).toBeChecked();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('arrow keys move between the options', async () => {
  const user = userEvent.setup();

  renderApp(<Harness />);

  await findClosedOption();
  await user.tab();
  expect(closedOption()).toHaveFocus();

  await user.keyboard('{ArrowDown}');

  expect(openOption()).toHaveFocus();
  await waitFor(() => expect(storedMembersCanInvite()).toBe(true), LAZY_TIMEOUT);
  await waitFor(
    () => expect(openOption()).toHaveAttribute('aria-disabled', 'false'),
    LAZY_TIMEOUT,
  );
  expect(openOption()).toBeChecked();
});

test('choosing the checked option sends nothing', async () => {
  const user = userEvent.setup();
  let patchCalls = 0;
  server.use(
    http.patch(SPACE_URL, () => {
      patchCalls += 1;
      return HttpResponse.json({});
    }),
  );

  renderApp(<Harness />);

  await user.click(await findClosedOption());

  expect(closedOption()).toBeChecked();
  expect(closedOption()).toHaveAttribute('aria-disabled', 'false');
  expect(screen.getByText(SENTENCE)).toBeInTheDocument();
  expect(patchCalls).toBe(0);
});
