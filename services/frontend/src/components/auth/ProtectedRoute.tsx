/**
 * Protected Route Component - Enforces role-based access control
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { UserRole } from '../../types/user';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

export const ProtectedRoute = ({
  children,
  allowedRoles,
  redirectTo,
}: ProtectedRouteProps) => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);

  // If not authenticated, Keycloak should handle this at App.tsx level
  // But as a fallback, redirect to home
  if (!isAuthenticated || !user) {
    console.warn('⚠️ [ProtectedRoute] User not authenticated');
    return <Navigate to="/" replace />;
  }

  // Check if user has any of the allowed roles
  const hasPermission = user.roles.some((role) => allowedRoles.includes(role));

  if (!hasPermission) {
    console.warn(
      `⚠️ [ProtectedRoute] Access denied for user with roles: ${user.roles.join(', ')}. Required: ${allowedRoles.join(', ')}`
    );

    // Smart redirect based on user role
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    // Default: Foremen go to TNM creation, others to dashboard
    if (user.roles.includes(UserRole.FOREMAN)) {
      return <Navigate to="/tnm/create" replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
