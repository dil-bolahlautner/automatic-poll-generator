import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/authService';
import { keepAlive } from '../services/authService';

interface User {
  id: number;
  email: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  isLoading: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) {
      try {
        // Decode JWT to get user info (simple base64 decode, not verified)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.sub, email: payload.email || '', is_admin: payload.is_admin || false });
        localStorage.setItem('token', token);
      } catch (error) {
        console.error('AuthContext: Error decoding token:', error);
        // Token is invalid, clear it
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
      }
    } else {
      setUser(null);
      localStorage.removeItem('token');
    }
  }, [token]);

  // Heartbeat effect for session keep-alive
  useEffect(() => {
    if (!token) return;
    let interval: NodeJS.Timeout;
    let isActive = true;
    let started = false;

    const sendKeepAlive = async () => {
      if (!token) return;
      try {
        await keepAlive(token);
      } catch (err) {
        if (err instanceof Error && err.message === 'Session expired') {
          logout();
        }
      }
    };

    // Wait a tick to ensure login state is set before first keep-alive
    const startHeartbeat = () => {
      if (started) return;
      started = true;
      sendKeepAlive();
      interval = setInterval(() => {
        if (isActive) sendKeepAlive();
      }, 5 * 60 * 1000);
    };
    const timeout = setTimeout(startHeartbeat, 100); // 100ms delay

    // On tab close, stop heartbeat
    const handleUnload = () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(timeout);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authService.login(email, password);
      setToken(data.access_token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await authService.register(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}; 