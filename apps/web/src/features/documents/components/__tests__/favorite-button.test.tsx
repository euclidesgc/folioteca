import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { Notifications } from '@/components/ui/notifications/notifications';
import { env } from '@/config/env';
import { useDocument } from '@/features/documents/api/get-document';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen, userEvent, waitFor } from '@/testing/test-utils';

import { FavoriteButton } from '../favorite-button';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

const markFavorite = (documentId: string): void => {
  getDb().favorites.push({
    documentId,
    createdAt: new Date().toISOString(),
  });
};

// The button reads the document from the cache, like the page does: this
// harness is what makes the optimistic flip and the rollback visible.
function FavoriteButtonHarness({
  documentId,
}: {
  documentId: string;
}): React.JSX.Element {
  const documentQuery = useDocument({ documentId });

  return (
    <>
      {documentQuery.data ? (
        <FavoriteButton document={documentQuery.data.data} />
      ) : (
        <p>Carregando documento…</p>
      )}
      <Notifications />
    </>
  );
}

const renderButton = async (documentId: string): Promise<HTMLElement> => {
  renderApp(<FavoriteButtonHarness documentId={documentId} />);
  return screen.findByRole('button', { name: /favoritos/ });
};

// Holds the favorite request open so the pending state can be observed.
const openGate = (): { release: () => void; count: () => number } => {
  let calls = 0;
  let resolveGate = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });

  server.use(
    http.put(`${env.API_URL}/documents/:documentId/favorite`, async () => {
      calls += 1;
      await gate;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return { release: () => resolveGate(), count: () => calls };
};

test('shows Adicionar aos favoritos with aria-pressed false', async () => {
  const seeded = firstSeededDocument();

  const button = await renderButton(seeded.id);

  expect(button).toHaveTextContent('Adicionar aos favoritos');
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(button).not.toHaveAttribute('aria-label');
});

test('shows Remover dos favoritos with aria-pressed true', async () => {
  const seeded = firstSeededDocument();
  markFavorite(seeded.id);

  const button = await renderButton(seeded.id);

  expect(button).toHaveTextContent('Remover dos favoritos');
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).not.toHaveAttribute('aria-label');
});

test('the star is hidden from assistive technology and filled only when favorite', async () => {
  const seeded = firstSeededDocument();

  const { unmount } = renderApp(
    <FavoriteButtonHarness documentId={seeded.id} />,
  );
  const plain = await screen.findByRole('button', { name: /favoritos/ });
  const plainStar = plain.querySelector('svg');

  expect(plainStar).toHaveAttribute('aria-hidden', 'true');
  expect(plainStar).toHaveAttribute('focusable', 'false');
  expect(plainStar).toHaveAttribute('stroke', 'currentColor');
  expect(plainStar).toHaveAttribute('fill', 'none');
  expect(plainStar).not.toHaveClass('text-amber-600');

  unmount();

  markFavorite(seeded.id);
  renderApp(<FavoriteButtonHarness documentId={seeded.id} />);
  const favorite = await screen.findByRole('button', {
    name: 'Remover dos favoritos',
  });
  const filledStar = favorite.querySelector('svg');

  expect(filledStar).toHaveAttribute('aria-hidden', 'true');
  expect(filledStar).toHaveAttribute('fill', 'currentColor');
  expect(filledStar).toHaveClass('text-amber-600');
});

test('toggles with Enter', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  const button = await renderButton(seeded.id);
  await user.tab();
  expect(button).toHaveFocus();

  await user.keyboard('{Enter}');

  expect(
    await screen.findByRole('button', { name: 'Remover dos favoritos' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('toggles with Space', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();

  const button = await renderButton(seeded.id);
  await user.tab();
  expect(button).toHaveFocus();

  await user.keyboard('[Space]');

  expect(
    await screen.findByRole('button', { name: 'Remover dos favoritos' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('a second click while pending sends a single request', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const gate = openGate();

  const button = await renderButton(seeded.id);

  await user.click(button);
  await user.click(button);

  expect(gate.count()).toBe(1);

  gate.release();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Remover dos favoritos' }),
    ).toBeInTheDocument(),
  );
});

test('is never disabled while pending', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  const gate = openGate();

  const button = await renderButton(seeded.id);

  await user.click(button);

  expect(button).not.toBeDisabled();
  expect(button).not.toHaveAttribute('disabled');
  expect(button).toHaveFocus();

  gate.release();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Remover dos favoritos' }),
    ).toBeInTheDocument(),
  );
});

test('rolls back and shows the notification when the server fails', async () => {
  const user = userEvent.setup();
  const seeded = firstSeededDocument();
  server.use(
    http.put(`${env.API_URL}/documents/:documentId/favorite`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  const button = await renderButton(seeded.id);

  await user.click(button);

  expect(await screen.findByText('Algo deu errado')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Adicionar aos favoritos' }),
    ).toHaveAttribute('aria-pressed', 'false'),
  );
});
