import type React from 'react';

import { useUser } from '@/lib/auth';
import type { CurrentUser } from '@/types/api';

// Authorization on the front is experience of use only: it decides what to
// draw, so nobody sees an action that would fail. What really blocks the
// action is the API, which answers 403 on every request.

export const ROLES = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;

export type Role = keyof typeof ROLES;

// The contract has no role field: the role is derived from `person.isAdmin`,
// which the server reads from the database on every request. This is the only
// place in the web that reads it to decide access.
export const getRole = (user: CurrentUser): Role =>
  user.person.isAdmin ? ROLES.ADMIN : ROLES.MEMBER;

// There is no POLICIES table here: this delivery has no resource policy, only
// the role. A rule that looks at a resource (its owner, its state) gets one.

export const useAuthorization = () => {
  const user = useUser();

  if (!user.data) {
    throw new Error(
      'useAuthorization só pode ser usado dentro de uma rota protegida.',
    );
  }

  const role = getRole(user.data);

  const checkAccess = ({ allowedRoles }: { allowedRoles: Role[] }): boolean =>
    allowedRoles.length > 0 && allowedRoles.includes(role);

  return { checkAccess, role, user: user.data };
};

type AuthorizationProps = {
  children: React.ReactNode;
  forbiddenFallback?: React.ReactNode;
} & (
  | { allowedRoles: Role[]; policyCheck?: never }
  | { allowedRoles?: never; policyCheck: boolean }
);

export const Authorization = ({
  children,
  forbiddenFallback = null,
  allowedRoles,
  policyCheck,
}: AuthorizationProps): React.JSX.Element => {
  const { checkAccess } = useAuthorization();

  const canAccess = allowedRoles
    ? checkAccess({ allowedRoles })
    : policyCheck === true;

  return <>{canAccess ? children : forbiddenFallback}</>;
};
