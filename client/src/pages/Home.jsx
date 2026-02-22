import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';

function Home() {
  const { user, login, logout, theme, toggleTheme } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [joinId, setJoinId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(name.trim());
    } catch {
      setError('Failed to set name. Please try again.');
    }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || null, creator_id: user.id })
      });
      if (!res.ok) throw new Error('Failed to create room');
      const room = await res.json();
      navigate(`/room/${room.id}`);
    } catch {
      setError('Failed to create room. Please try again.');
      setLoading(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const raw = joinId.trim();
    if (!raw) return;
    const match = raw.match(/\/room\/([^/?#]+)/);
    navigate(`/room/${match ? match[1] : raw}`);
  };

  if (!user) {
    return (
      <div className="home-container">
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <div className="home-hero">
          <div className="home-logo">S</div>
          <h1 className="home-title">SynergY</h1>
          <p className="home-subtitle">Create a room, share the link, write together.</p>
          <form className="name-form" onSubmit={handleSetName}>
            <input
              className="input"
              type="text"
              placeholder="Enter your name to get started"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Setting up…' : 'Continue →'}
            </button>
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <div className="home-hero">
        <div className="home-logo">S</div>
        <h1 className="home-title">SynergY</h1>
        <p className="home-subtitle">
          Hello, <strong>{user.name}</strong>
        </p>

        <div className="home-actions">
          <div className="action-card">
            <h2>Create a Room</h2>
            <p className="action-desc">Start a new collaborative writing space. A unique link is generated instantly.</p>
            <form onSubmit={handleCreate}>
              <input
                className="input"
                type="text"
                placeholder="Room title (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={100}
              />
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating…' : '+ Create New Room'}
              </button>
            </form>
          </div>

          <div className="home-divider">
            <span>or</span>
          </div>

          <div className="action-card">
            <h2>Join a Room</h2>
            <p className="action-desc">Paste a room link or ID to join an existing writing session.</p>
            <form onSubmit={handleJoin}>
              <input
                className="input"
                type="text"
                placeholder="Room ID or full link"
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
              />
              <button className="btn btn-secondary" type="submit" disabled={!joinId.trim()}>
                Join Room →
              </button>
            </form>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn-link muted" onClick={logout}>
          Not {user.name}? Change name
        </button>
      </div>
    </div>
  );
}

export default Home;
