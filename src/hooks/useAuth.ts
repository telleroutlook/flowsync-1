import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';
import type { User } from '../../types';

const TOKEN_KEY = 'flowsync:authToken';

const readToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
};

const clearToken = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token = readToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const result = await apiService.me();
      setUser(result.user);
    } catch (err) {
      clearToken();
      setUser(null);
      setError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiService.login({ username, password });
      storeToken(result.token);
      setUser(result.user);
      return result.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiService.register({ username, password });
      storeToken(result.token);
      setUser(result.user);
      return result.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiService.logout();
    } catch {
      // ignore
    } finally {
      clearToken();
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    refresh,
    login,
    register,
    logout,
  };
};
