import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { AppLayout } from '../app-layout';

const renderLayout = (initialEntries: string[] = ['/']) => {
  const routes = [
    {
      path: '/',
      element: (
        <AppLayout sidebarFooter={<p>Rodapé de teste</p>}>
          <Outlet />
        </AppLayout>
      ),
      children: [
        { index: true, element: <p>Conteúdo do início</p> },
        { path: 'favorites', element: <p>Conteúdo de favoritos</p> },
      ],
    },
  ];
  const router = createMemoryRouter(routes, { initialEntries });
  return render(<RouterProvider router={router} />);
};

test('renders the four navigation links in order inside the main navigation landmark', () => {
  renderLayout();

  const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
  const links = within(nav).getAllByRole('link');

  expect(links.map((link) => link.textContent)).toEqual([
    'Favoritos',
    'Meus documentos',
    'Espaços',
    'Lixeira',
  ]);
});

test('marks the link of the current route with aria-current page', () => {
  renderLayout(['/favorites']);

  expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('renders the sidebarFooter slot', () => {
  renderLayout();

  expect(screen.getByText('Rodapé de teste')).toBeInTheDocument();
});

test('skip link is the first focusable element and targets main-content', async () => {
  const user = userEvent.setup();
  renderLayout();

  const skipLink = screen.getByRole('link', {
    name: 'Pular para o conteúdo',
  });
  expect(skipLink).toHaveAttribute('href', '#main-content');

  await user.tab();

  expect(document.activeElement).toBe(skipLink);
});

test('menu button starts collapsed with aria-expanded false and the label Abrir menu', () => {
  renderLayout();

  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('clicking the menu button expands the panel and changes the label to Fechar menu', async () => {
  const user = userEvent.setup();
  renderLayout();

  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));

  expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('menu button toggles with the keyboard using Enter and Space', async () => {
  const user = userEvent.setup();
  renderLayout();

  const button = screen.getByRole('button', { name: 'Abrir menu' });
  button.focus();
  await user.keyboard('{Enter}');

  expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await user.keyboard(' ');

  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('Escape collapses the panel and returns focus to the menu button', async () => {
  const user = userEvent.setup();
  renderLayout();

  const button = screen.getByRole('button', { name: 'Abrir menu' });
  await user.click(button);
  expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await user.keyboard('{Escape}');

  const collapsedButton = screen.getByRole('button', { name: 'Abrir menu' });
  expect(collapsedButton).toHaveAttribute('aria-expanded', 'false');
  expect(document.activeElement).toBe(collapsedButton);
});

test('collapses the panel after navigating to another route', async () => {
  const user = userEvent.setup();
  renderLayout();

  await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
  expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await user.click(screen.getByRole('link', { name: 'Favoritos' }));

  expect(await screen.findByText('Conteúdo de favoritos')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('aria-controls of the menu button matches the panel id', () => {
  renderLayout();

  const button = screen.getByRole('button', { name: 'Abrir menu' });
  const panelId = button.getAttribute('aria-controls');

  expect(panelId).toBeTruthy();
  expect(document.getElementById(panelId ?? '')).toBeInTheDocument();
});
