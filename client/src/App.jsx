import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Start from './pages/Start';
import Room from './pages/Room';
import Auth from './pages/Auth';

export const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

const LS_TOKEN = 'collab_token';
const LS_USER = 'collab_user';

function App() {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(LS_TOKEN) || '');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const logout = () => {
    setUser(null);
    setAuthToken('');
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  };

  const apiFetch = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    return fetch(url, { ...options, headers });
  };

  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem(LS_TOKEN) || '';
      const storedUser = localStorage.getItem(LS_USER);
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setAuthToken(token);
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('not authed');
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(LS_USER, JSON.stringify(data.user));
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithPassword = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Login failed');
    }

    setAuthToken(data.token);
    setUser(data.user);
    localStorage.setItem(LS_TOKEN, data.token);
    localStorage.setItem(LS_USER, JSON.stringify(data.user));
    return data.user;
  };

  const registerWithPassword = async ({ username, password, name, color }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name, color })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Registration failed');
    }

    setAuthToken(data.token);
    setUser(data.user);
    localStorage.setItem(LS_TOKEN, data.token);
    localStorage.setItem(LS_USER, JSON.stringify(data.user));
    return data.user;
  };

  const updateProfile = async ({ name, color }) => {
    const res = await apiFetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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
    <UserContext.Provider value={{
      user,
      authToken,
      apiFetch,
      loginWithPassword,
      registerWithPassword,
      updateProfile,
      logout,
      theme,
      toggleTheme,
    }}>
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