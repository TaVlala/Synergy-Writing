import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { parseJsonResponse } from './lib/api';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Room from './pages/Room';
import Start from './pages/Start';

export const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

const LS_TOKEN = 'collab_token';
const LS_USER = 'collab_user';
const LS_THEME = 'theme';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function App() {
  const [user, setUser] = useState(() => readStoredUser());
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(LS_TOKEN) || '');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem(LS_THEME) || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  const persistSession = session => {
    setAuthToken(session.token);
    setUser(session.user);
    localStorage.setItem(LS_TOKEN, session.token);
    localStorage.setItem(LS_USER, JSON.stringify(session.user));
  };

  const clearSession = () => {
    setUser(null);
    setAuthToken('');
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  };

  const toggleTheme = () => setTheme(current => (current === 'light' ? 'dark' : 'light'));

  const apiFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    return fetch(url, { ...options, headers });
  };

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const token = localStorage.getItem(LS_TOKEN) || '';
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await parseJsonResponse(response);
        if (!response.ok || !data?.user) {
          clearSession();
          return;
        }
        if (!cancelled) {
          persistSession({ token, user: data.user });
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithPassword = async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Login failed');
    }
    persistSession(data);
    return data.user;
  };

  const registerWithPassword = async ({ username, password, name, color }) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name, color }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Registration failed');
    }
    persistSession(data);
    return data.user;
  };

  const updateProfile = async ({ name, color }) => {
    const response = await apiFetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Profile update failed');
    }
    setUser(data);
    localStorage.setItem(LS_USER, JSON.stringify(data));
    return data;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <UserContext.Provider
      value={{
        user,
        authToken,
        apiFetch,
        loginWithPassword,
        registerWithPassword,
        updateProfile,
        logout: clearSession,
        theme,
        toggleTheme,
      }}
    >
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/start" element={<Start />} />
          <Route path="/room/:id" element={<Room />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;
