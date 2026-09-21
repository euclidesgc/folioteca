import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import type React from 'react';
import { expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { screen } from '@/testing/test-utils';
import type { CurrentUser } from '@/types/api';

import { Authorization, getRole, ROLES, useAuthorization } from '../authorization';

const userWith = (isAdmin: boolean): CurrentUser => ({
  organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
  person: {
    id: 'person-1',
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com.br',
    isAdmin,
  },
});

// Authorization runs below the gate, which has already resolved the session.
const createWrapper = (
  user: CurrentUser | null,
): ((props: { children: React.ReactNode }) => React.JSX.Element) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], user);

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const renderAuthorization = (
  ui: React.ReactElement,
  user: CurrentUser,
): ReturnType<typeof render> => {
  const Wrapper = createWrapper(user);
  return render(<Wrapper>{ui}</Wrapper>);
};

test('getRole returns ADMIN for an admin person', () => {
  expect(getRole(userWith(true))).toBe(ROLES.ADMIN);
});

test('getRole returns MEMBER for a person who is not admin', () => {
  expect(getRole(userWith(false))).toBe(ROLES.MEMBER);
});

test('checkAccess is true only when the role is allowed', () => {
  const { result } = renderHook(() => useAuthorization(), {
    wrapper: createWrapper(userWith(true)),
  });

  expect(result.current.role).toBe(ROLES.ADMIN);
  expect(result.current.user).toEqual(userWith(true));
  expect(result.current.checkAccess({ allowedRoles: [ROLES.ADMIN] })).toBe(true);
  expect(result.current.checkAccess({ allowedRoles: [ROLES.MEMBER] })).toBe(
    false,
  );
});

test('Authorization renders the children for an allowed role', () => {
  renderAuthorization(
    <Authorization allowedRoles={[ROLES.ADMIN]}>
      <p>Área da administração</p>
    </Authorization>,
    userWith(true),
  );

  expect(screen.getByText('Área da administração')).toBeInTheDocument();
});

test('Authorization renders the forbidden fallback for a role that is not allowed', () => {
  renderAuthorization(
    <Authorization
      allowedRoles={[ROLES.ADMIN]}
      forbiddenFallback={<p>Sem permissão</p>}
    >
      <p>Área da administração</p>
    </Authorization>,
    userWith(false),
  );

  expect(screen.getByText('Sem permissão')).toBeInTheDocument();
  expect(screen.queryByText('Área da administração')).not.toBeInTheDocument();
});

test('Authorization renders nothing without a fallback', () => {
  const { container } = renderAuthorization(
    <Authorization allowedRoles={[ROLES.ADMIN]}>
      <p>Área da administração</p>
    </Authorization>,
    userWith(false),
  );

  expect(container).toBeEmptyDOMElement();
});

test('Authorization follows policyCheck when given', () => {
  const { unmount } = renderAuthorization(
    <Authorization policyCheck={true}>
      <p>Conteúdo permitido</p>
    </Authorization>,
    userWith(false),
  );

  expect(screen.getByText('Conteúdo permitido')).toBeInTheDocument();

  unmount();

  renderAuthorization(
    <Authorization policyCheck={false} forbiddenFallback={<p>Sem permissão</p>}>
      <p>Conteúdo permitido</p>
    </Authorization>,
    userWith(true),
  );

  expect(screen.getByText('Sem permissão')).toBeInTheDocument();
  expect(screen.queryByText('Conteúdo permitido')).not.toBeInTheDocument();
});

test('useAuthorization throws without a signed-in user', () => {
  // React logs the error thrown while rendering the hook; silenced here only.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() =>
    renderHook(() => useAuthorization(), { wrapper: createWrapper(null) }),
  ).toThrow('useAuthorization só pode ser usado dentro de uma rota protegida.');

  consoleError.mockRestore();
});
