/**
 * Keycloak configuration and initialization
 */

import Keycloak from 'keycloak-js';

// Get runtime configuration with fallback to build-time env
const getRuntimeConfig = () => {
  const runtimeConfig = (window as any).__RUNTIME_CONFIG__ || {};
  return {
    url: runtimeConfig.KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || 'https://localhost:8443',
    realm: runtimeConfig.KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || 'changeorderino',
    clientId: runtimeConfig.KEYCLOAK_CLIENT_ID || import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'changeorderino-app',
  };
};

const keycloakConfig = getRuntimeConfig();

console.log('🔐 Keycloak configuration:', {
  url: keycloakConfig.url,
  realm: keycloakConfig.realm,
  clientId: keycloakConfig.clientId,
  source: (window as any).__RUNTIME_CONFIG__ ? 'runtime' : 'build-time',
});

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = async (): Promise<boolean> => {
  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      pkceMethod: 'S256',
      flow: 'standard',
    });

    if (authenticated) {
      // Set up token refresh
      setInterval(() => {
        keycloak.updateToken(70).catch(() => {
          console.error('Failed to refresh token');
          keycloak.logout();
        });
      }, 60000); // Check every minute
    }

    return authenticated;
  } catch (error) {
    console.error('Failed to initialize Keycloak:', error);
    return false;
  }
};

export const getToken = (): string | undefined => {
  return keycloak.token;
};

export const getUserInfo = () => {
  return keycloak.tokenParsed;
};

export const logout = () => {
  keycloak.logout({
    redirectUri: window.location.origin,
  });
};

export default keycloak;
