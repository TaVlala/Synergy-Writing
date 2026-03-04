import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../App';
import { APP_COLORS } from '../utils';
import { Moon, Sun, ArrowLeft } from 'lucide-react';

function ColorPicker({ selected, onChange }) {
  return (
    <div className="color-picker">
      {APP_COLORS.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch${selected === c ? ' color-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
    </div>
  );
}

function Start() {
  const { user, login, logout, theme, toggleTheme } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(APP_COLORS[5]);
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
      await login(name.trim(), undefined, selectedColor);
    } catch {
      setError('Failed to set name. Please try again.');
    }
    setLoading(false);
  };

  const handleColorChange = async (color) => {
    if (!user) return;
    try {
      await login(user.name, user.id, color);
    } catch {
      // non-critical
    }
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

  return (
    <div className="start-page">
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <Link to="/" className="start-back"><ArrowLeft size={15} /> Back</Link>

      <div className="start-content">
        {!user ? (
          <>
            <img src="/assets/logo.svg" alt="Penwove" className="start-logo" />
            <h2 className="landing-section-title">Ready to write?</h2>
            <p className="landing-section-sub">Enter your name to get started — no account needed.</p>
            <form className="name-form" onSubmit={handleSetName}>
              <input
                className="input"
                type="text"
                placeholder="What's your name?"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <div className="color-picker-row">
                <span className="color-picker-label">Choose your colour</span>
                <ColorPicker selected={selectedColor} onChange={setSelectedColor} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading || !name.trim()}>
                {loading ? 'Setting up…' : 'Continue →'}
              </button>
            </form>
          </>
        ) : (
          <>
            <img src="/assets/logo.svg" alt="Penwove" className="start-logo" />
            <h2 className="landing-section-title">
              Welcome back, <span style={{ color: user.color }}>{user.name}</span>
            </h2>
            <div className="color-picker-row" style={{ justifyContent: 'center', marginBottom: 36 }}>
              <span className="color-picker-label">Your colour</span>
              <ColorPicker selected={user.color} onChange={handleColorChange} />
            </div>
            <div className="home-actions">
              <div className="action-card">
                <h2>Create a Room</h2>
                <p className="action-desc">Start a new collaborative writing space.</p>
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
              <div className="home-divider"><span>or</span></div>
              <div className="action-card">
                <h2>Join a Room</h2>
                <p className="action-desc">Join an existing writing session.</p>
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
            <button className="btn-link muted" onClick={logout}>
              Not {user.name}? Change name
            </button>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default Start;
