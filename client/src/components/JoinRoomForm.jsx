import React from 'react';
import { Lock, PenLine } from 'lucide-react';
import { APP_COLORS } from '../utils';

function JoinRoomForm({
  room,
  nameInput,
  setNameInput,
  joinColor,
  setJoinColor,
  onLogin,
  navigate
}) {
  if (room?.is_entry_locked) {
    return (
      <div className="overlay">
        <div className="prompt-card">
          <div className="prompt-icon"><Lock size={32} strokeWidth={1.3} /></div>
          <h2>Room is closed</h2>
          <p>This room is no longer accepting new contributors.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="prompt-card">
        <div className="prompt-icon"><PenLine size={32} strokeWidth={1.3} /></div>
        <h2>Enter your name to join</h2>
        <p>You'll be able to read and contribute to this room.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!nameInput.trim()) return;
          await onLogin(nameInput.trim(), undefined, joinColor);
        }}>
          <input
            className="input"
            type="text"
            placeholder="Your name"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            maxLength={50}
            autoFocus
          />
          <div className="color-picker-row">
            <span className="color-picker-label">Pick your color</span>
            <div className="color-picker">
              {APP_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch${joinColor === c ? ' color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setJoinColor(c)}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={!nameInput.trim()}>
            Join Room →
          </button>
        </form>
      </div>
    </div>
  );
}

export default React.memo(JoinRoomForm);
