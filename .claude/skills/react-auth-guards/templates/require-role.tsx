import type { ReactNode } from 'react';

import { useSessionUser, type UserRole } from '@/shared/stores/session-store';

type RequireRoleProps = {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  const user = useSessionUser();
  if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
