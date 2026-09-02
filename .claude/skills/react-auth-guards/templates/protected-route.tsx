import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { FullPageSpinner } from '@/shared/components/full-page-spinner';
import { useSession, type UserRole } from '@/features/auth';

type ProtectedRouteProps = {
  roles?: UserRole[];
  children: ReactNode;
};

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, status } = useSession();

  if (status === 'loading') {
    return <FullPageSpinner label="Verificando sua sessão…" />;
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/sem-acesso" replace />;
  }

  return <>{children}</>;
}
