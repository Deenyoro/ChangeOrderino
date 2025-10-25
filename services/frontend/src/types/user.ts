/**
 * User and authentication types
 */

export enum UserRole {
  ADMIN = 'admin',
  FOREMAN = 'foreman',
  PROJECT_MANAGER = 'project_manager',
  OFFICE_STAFF = 'office_staff',
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  roles: UserRole[];
  keycloak_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token?: string;
}
