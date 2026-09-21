import { expect, test } from 'vitest';

import { seedInstalled } from '@/testing/mocks/db';
import { renderApp, screen, waitFor } from '@/testing/test-utils';

import { SidebarIdentity } from '../sidebar-identity';

test('shows the organization name and the person name', async () => {
  seedInstalled({ signedIn: true });

  renderApp(<SidebarIdentity />);

  expect(
    await screen.findByText('Biblioteca Municipal de Exemplo'),
  ).toBeInTheDocument();
  expect(screen.getByText('Ana Souza')).toBeInTheDocument();
});

test('labels them Organização and Pessoa for screen readers', async () => {
  seedInstalled({ signedIn: true });

  renderApp(<SidebarIdentity />);

  const organizationTerm = await screen.findByText('Organização');
  expect(organizationTerm.tagName).toBe('DT');
  expect(organizationTerm).toHaveClass('sr-only');

  const personTerm = screen.getByText('Pessoa');
  expect(personTerm.tagName).toBe('DT');
  expect(personTerm).toHaveClass('sr-only');
});

test('renders nothing without a user', async () => {
  const { container } = renderApp(<SidebarIdentity />);

  await waitFor(() => expect(container).toBeEmptyDOMElement());
  expect(screen.queryByText('Organização')).not.toBeInTheDocument();
});
