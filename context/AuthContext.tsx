'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  name: string;
  role_id: number;
  role_code: 'ADMIN';
  role_name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(`/api/auth/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Máy chủ trả về HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await authRequest('me');
      setUser(data.user);
    } catch {
      setUser(null);
      localStorage.removeItem('ewarehouse_bootstrap_cache');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      localStorage.removeItem('ewarehouse_bootstrap_cache');
    };
    window.addEventListener('ewarehouse:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ewarehouse:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const data = await authRequest('login', {
      method: 'POST',
      body: JSON.stringify({ username, password, remember_me: rememberMe }),
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authRequest('logout', { method: 'POST', body: '{}' });
    } finally {
      localStorage.removeItem('ewarehouse_bootstrap_cache');
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  return context;
}
