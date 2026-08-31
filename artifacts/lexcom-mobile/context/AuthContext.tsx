import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const ISSUER = 'https://replit.com/oidc';
const CLIENT_ID = process.env.EXPO_PUBLIC_REPL_ID ?? '';
const TOKEN_KEY = 'lexcom_session_token';

export function getApiBase() {
  return `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
}

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'lexcom-mobile' });
  const discovery = AuthSession.useAutoDiscovery(ISSUER);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: ['openid', 'email', 'profile', 'offline_access'],
      redirectUri,
      usePKCE: true,
    },
    discovery,
  );

  async function clearLocalSession() {
    try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }

  // Load stored token on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          setToken(stored);
          await loadUser(stored);
        }
      } catch {
        // ignore secure store errors on web
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    if (response?.type !== 'success') return;
    const { code } = response.params;
    if (!code || !request?.codeVerifier) return;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/mobile-auth/token-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier: request.codeVerifier!,
            redirect_uri: redirectUri,
            state: response.params.state ?? '',
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as { token: string };
        await SecureStore.setItemAsync(TOKEN_KEY, data.token);
        setToken(data.token);
        await loadUser(data.token);
      } catch {
        // ignore
      }
    })();
  }, [response]);

  async function loadUser(sid: string) {
    try {
      const res = await fetch(`${getApiBase()}/auth/user`, {
        headers: { Authorization: `Bearer ${sid}` },
      });
      if (res.status === 401) {
        await clearLocalSession();
        return;
      }
      if (!res.ok) return;
      const data = await res.json() as { user: AuthUser | null };
      if (!data.user) {
        await clearLocalSession();
        return;
      }
      setUser(data.user);
    } catch {
      // ignore
    }
  }

  const login = useCallback(async () => {
    if (!request) return;
    await promptAsync();
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch(`${getApiBase()}/mobile-auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* ignore */ }
    }
    await clearLocalSession();
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
