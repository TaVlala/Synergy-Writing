import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';

export const UserContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const stored = localStorage.getItem('collab_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parsed.id, name: parsed.name })
      })
        .then(r => r.json())
        .then(u => {
          setUser(u);
          localStorage.setItem('collab_user', JSON.stringify(u));
        })
        .catch(() => setUser(parsed))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (name, existingId) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id: existingId })
    });
    const u = await res.json();
    setUser(u);
    localStorage.setItem('collab_user', JSON.stringify(u));
    return u;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('collab_user');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, login, logout, theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<Room />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}

export default App;
