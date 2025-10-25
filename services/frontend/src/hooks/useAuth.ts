/**
 * Authentication hook
 */

import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setUser, logout as logoutAction } from '../store/slices/authSlice';
import { logout as keycloakLogout } from '../keycloak';
import { User, UserRole } from '../types/user';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  const login = (userData: User) => {
    dispatch(setUser(userData));
  };

  const logout = () => {
    dispatch(logoutAction());
    keycloakLogout();
  };

  const hasRole = (role: string): boolean => {
    return user?.roles.includes(role as any) || false;
  };

  const isForeman = user?.roles.includes(UserRole.FOREMAN) || false;
  const isAdmin = user?.roles.includes(UserRole.ADMIN) || false;
  const isProjectManager = user?.roles.includes(UserRole.PROJECT_MANAGER) || false;
  const isOfficeStaff = user?.roles.includes(UserRole.OFFICE_STAFF) || false;

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
    isForeman,
    isAdmin,
    isProjectManager,
    isOfficeStaff,
  };
};
