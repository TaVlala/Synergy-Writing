import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Moon, Sun, ArrowLeft } from 'lucide-react';
import { useUser } from '../App';
import { APP_COLORS } from '../utils';

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

function Auth() {
  const { theme, toggleTheme, loginWithPassword, registerWithPassword } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(APP_COLORS[5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithPassword(username, password);
      } else {
        await registerWithPassword({ username, password, name, color });
      }
      navigate('/start');
    } catch (err) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="start-page">
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <Link to="/" className="start-back"><ArrowLeft size={15} /> Back</Link>

      <div className="start-content">
        <img src="/assets/logo.svg" alt="Penwove" className="start-logo" />

        <div className="segmented" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <button
            type="button"
            className={`segmented-btn${mode === 'login' ? ' active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`segmented-btn${mode === 'register' ? ' active' : ''}`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
        </div>

        <h2 className="landing-section-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="landing-section-sub">
          {mode === 'login'
            ? 'Login to join rooms and keep your identity consistent.'
            : 'Pick a username and password to start writing.'}
        </p>

        <form className="name-form" onSubmit={onSubmit}>
          <input
            className="input"
            type="text"
            placeholder="Username (a-z, 0-9, _)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={32}
            autoComplete="username"
            autoFocus
          />

          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'register' && (
            <>
              <input
                className="input"
                type="text"
                placeholder="Display name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={50}
                autoComplete="name"
              />

              <div className="color-picker-row">
                <span className="color-picker-label">Choose your colour</span>
                <ColorPicker selected={color} onChange={setColor} />
              </div>
            </>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !username.trim() || !password}
          >
            {loading
              ? (mode === 'login' ? 'Logging in...' : 'Creating...')
              : (mode === 'login' ? 'Login ->' : 'Create account ->')}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}

        <p className="muted" style={{ marginTop: 14, textAlign: 'center' }}>
          In production, set JWT_SECRET.
        </p>
      </div>
    </div>
  );
}

export default Auth;