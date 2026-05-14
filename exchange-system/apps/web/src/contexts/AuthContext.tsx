'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserSummary, AuthResponse, LoginResult } from '@exchange/shared';
import api from '@/lib/api';
import { setStoredAuth, clearStoredAuth, getStoredUser } from '@/lib/auth';

interface AuthContextValue {
  user: UserSummary | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    const { data } = await api.post<LoginResult>('/auth/login', { username, password });

    if ('accessToken' in data) {
      setStoredAuth((data as AuthResponse).accessToken, (data as AuthResponse).user);
      setUser((data as AuthResponse).user);
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearStoredAuth();
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
