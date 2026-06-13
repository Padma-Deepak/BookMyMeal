import React, { createContext, useContext, useState, useEffect } from 'react';
import { setTokens, clearTokens, apiGet, apiFetch } from '../lib/api';

export type UserRole = 'guest' | 'caterer' | 'caretaker' | 'manager' | 'superuser';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  email: string;
  phone_number: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session from stored token
    const token = localStorage.getItem('access_token');
    if (token) {
      apiGet<User>('/me/')
        .then(setUser)
        .catch(() => {
          clearTokens();
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    const res = await apiFetch('/token/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Invalid username or password');
    }
    const { access, refresh } = await res.json();
    setTokens(access, refresh);
    const me = await apiGet<User>('/me/');
    setUser(me);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
