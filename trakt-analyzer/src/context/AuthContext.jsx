import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { traktApi } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    const sessionId = localStorage.getItem('trakt_session_id');
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      const response = await traktApi.getProfile();
      setUser(response.data);
    } catch (err) {
      // Token might be expired
      localStorage.removeItem('trakt_session_id');
      localStorage.removeItem('trakt_access_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (code, state) => {
    setLoading(true);
    setError(null);
    try {
      const response = await traktApi.handleCallback(code, state);
      const { sessionId, accessToken } = response.data;
      localStorage.setItem('trakt_session_id', sessionId);
      localStorage.setItem('trakt_access_token', accessToken);
      await checkAuth();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || '登录失败，请重试');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    const sessionId = localStorage.getItem('trakt_session_id');
    if (sessionId) {
      try {
        await traktApi.logout(sessionId);
      } catch (err) {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('trakt_session_id');
    localStorage.removeItem('trakt_access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
