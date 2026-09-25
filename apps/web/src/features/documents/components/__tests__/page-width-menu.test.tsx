import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import {
  usePageWidth,
  usePageWidthStore,
} from '@/features/documents/stores/page-width-store';
import { useUser } from '@/lib/auth';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { PageWidthMenu } from '../page-width-menu';

beforeEach(() => {
  usePageWidthStore.setState(usePageWidthStore.getInitialState());
  seedInstalled({ signedIn: true });
});

// The menu next to a stand-in for the sheet, the way the document page uses
// it, once the session is known.
function PageWidthMenuHarness(): React.JSX.Element {
  const user = useUser();
  const width = usePageWidth();

  return (
    <>
      {user.data ? (
        <>
          <PageWidthMenu />
          <div data-testid="sheet" data-page-width={width} />
        </>
      ) : (
        <p>Carregando sessão…</p>
      )}
      <Notifications />
    </>
  );
}

const renderMenu = async (): Promise<HTMLElement> => {
  renderApp(<PageWidthMenuHarness />);
  return screen.findByRole('button', { name: 'Largura da página' });
};

const sheet = (): HTMLElement => screen.getByTestId('sheet');

test('the button exposes aria-expanded and aria-controls', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  expect(button).toHaveAttribute('aria-expanded', 'false');
  const panelId = button.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  expect(document.getElementById(panelId ?? '')).toBeInTheDocument();

  await user.click(button);

  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(panelId ?? '')).toBeVisible();
});

test('opening the menu focuses the checked radio', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  await user.click(button);

  const medium = screen.getByRole('radio', { name: 'Média' });
  expect(medium).toBeChecked();
  await waitFor(() => expect(medium).toHaveFocus());
});

test('arrow keys change the width right away', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  await user.click(button);
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Média' })).toHaveFocus(),
  );

  await user.keyboard('{ArrowDown}');

  await waitFor(() =>
    expect(sheet()).toHaveAttribute('data-page-width', 'large'),
  );
  expect(screen.getByRole('radio', { name: 'Grande' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Grande' })).toHaveFocus();
});

test('clicking an option changes the width and keeps the menu open', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  await user.click(button);
  await user.click(screen.getByRole('radio', { name: 'Completa' }));

  await waitFor(() =>
    expect(sheet()).toHaveAttribute('data-page-width', 'full'),
  );
  expect(screen.getByRole('radio', { name: 'Completa' })).toBeChecked();
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('radio', { name: 'Completa' })).toBeVisible();
});

test('Escape closes the menu and returns focus to the button', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  await user.click(button);
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Média' })).toHaveFocus(),
  );

  await user.keyboard('{Escape}');

  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveFocus();
  expect(
    screen.queryByRole('radio', { name: 'Média' }),
  ).not.toBeInTheDocument();
});

test('clicking outside closes the menu', async () => {
  const user = userEvent.setup();
  const button = await renderMenu();

  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');

  await user.click(sheet());

  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen.queryByRole('radio', { name: 'Média' }),
  ).not.toBeInTheDocument();
});

test('while saving the radios are aria-disabled and never disabled', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/auth/me/preferences`, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const button = await renderMenu();

  await user.click(button);
  await user.click(screen.getByRole('radio', { name: 'Grande' }));

  expect(
    await screen.findByText('A largura vale para todos os seus documentos. Salvando…'),
  ).toBeInTheDocument();
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(4);
  expect(radios.map((radio) => radio.getAttribute('aria-disabled'))).toEqual([
    'true',
    'true',
    'true',
    'true',
  ]);
  expect(screen.getByRole('radio', { name: 'Grande' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('radio', { name: 'Pequena' })).not.toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Média' })).not.toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Grande' })).not.toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Completa' })).not.toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Grande' })).toHaveFocus();

  // A second choice while sending is ignored.
  await user.click(screen.getByRole('radio', { name: 'Pequena' }));

  expect(screen.getByRole('radio', { name: 'Grande' })).toBeChecked();
  expect(sheet()).toHaveAttribute('data-page-width', 'large');
});

test('a failed save keeps the new width and shows the notification', async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${env.API_URL}/auth/me/preferences`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );
  const button = await renderMenu();

  await user.click(button);
  await user.click(screen.getByRole('radio', { name: 'Grande' }));

  expect(await screen.findByText('Algo deu errado')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'Grande' }),
    ).not.toHaveAttribute('aria-disabled', 'true'),
  );
  expect(screen.getByRole('radio', { name: 'Grande' })).toBeChecked();
  expect(sheet()).toHaveAttribute('data-page-width', 'large');
  expect(screen.queryByRole('alert', { name: /largura/i })).not.toBeInTheDocument();
});
