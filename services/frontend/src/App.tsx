/**
 * Main App component with routing
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store';
import { initKeycloak, getUserInfo } from './keycloak';
import { setUser, setLoading } from './store/slices/authSlice';
import { LoadingScreen } from './components/common/LoadingSpinner';
import { Layout } from './components/layout/Layout';
import { UserRole } from './types/user';

// Pages
import { Dashboard } from './pages/Dashboard';
import { ProjectsPage } from './pages/ProjectsPage';
import { NewProjectPage } from './pages/NewProjectPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TNMTicketsPage } from './pages/TNMTicketsPage';
import { CreateTNMPage } from './pages/CreateTNMPage';
import { TNMDetailPage } from './pages/TNMDetailPage';
import { GCApprovalPage } from './pages/GCApprovalPage';
import { NotFoundPage } from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Check runtime config first, fallback to build-time env
  const getRuntimeAuthEnabled = () => {
    const runtimeConfig = (window as any).__RUNTIME_CONFIG__ || {};
    if (runtimeConfig.AUTH_ENABLED !== undefined) {
      return runtimeConfig.AUTH_ENABLED === 'true' || runtimeConfig.AUTH_ENABLED === true;
    }
    return import.meta.env.VITE_AUTH_ENABLED === 'true';
  };

  const authEnabled = getRuntimeAuthEnabled();

  console.log('🔐 Authentication mode:', authEnabled ? 'ENABLED' : 'DISABLED');
  console.log('🔐 Auth source:', (window as any).__RUNTIME_CONFIG__ ? 'runtime' : 'build-time');

  useEffect(() => {
    const initAuth = async () => {
      if (!authEnabled) {
        // Mock user for development without auth
        store.dispatch(setUser({
          id: 'dev-user',
          email: 'dev@example.com',
          full_name: 'Dev User',
          roles: [UserRole.ADMIN],
          keycloak_id: 'dev',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setIsAuthReady(true);
        return;
      }

      try {
        const authenticated = await initKeycloak();

        if (authenticated) {
          const userInfo = getUserInfo();

          // Map Keycloak user info to our User type
          const keycloakRoles = userInfo?.realm_access?.roles || [];
          const mappedRoles = keycloakRoles
            .filter((role: string) => Object.values(UserRole).includes(role as UserRole))
            .map((role: string) => role as UserRole);

          const user = {
            id: userInfo?.sub || '',
            email: userInfo?.email || '',
            full_name: userInfo?.name || userInfo?.preferred_username || '',
            roles: mappedRoles,
            keycloak_id: userInfo?.sub || '',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          store.dispatch(setUser(user));
        }
      } catch (error) {
        console.error('Authentication error:', error);
        store.dispatch(setLoading(false));
      } finally {
        setIsAuthReady(true);
      }
    };

    initAuth();
  }, [authEnabled]);

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Protected routes with layout */}
            <Route element={<Layout><Dashboard /></Layout>} path="/" />

            {/* Projects */}
            <Route element={<Layout><ProjectsPage /></Layout>} path="/projects" />
            <Route element={<Layout><NewProjectPage /></Layout>} path="/projects/new" />
            <Route element={<Layout><ProjectDetailPage /></Layout>} path="/projects/:id" />

            {/* TNM Tickets */}
            <Route element={<Layout><TNMTicketsPage /></Layout>} path="/tnm-tickets" />
            <Route element={<Layout><CreateTNMPage /></Layout>} path="/tnm/create" />
            <Route element={<Layout><TNMDetailPage /></Layout>} path="/tnm/:id" />

            {/* Public GC Approval (no auth) */}
            <Route element={<GCApprovalPage />} path="/approve/:token" />

            {/* 404 */}
            <Route element={<NotFoundPage />} path="*" />
          </Routes>

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
