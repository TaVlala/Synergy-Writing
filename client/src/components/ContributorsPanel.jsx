import React from 'react';
import { formatTime } from '../utils';

function ContributorsPanel({ members, isCreator, currentUser, onRemove, onClose }) {
  const active = members.filter(m => !m.removed_at);
  const removed = members.filter(m => m.removed_at);

  return (
    <div className="contributors-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="contributors-panel">

        {/* Header */}
        <div className="contributors-header">
          <div className="contributors-title">
            <span className="contributors-icon">👥</span>
            <h2>Contributors</h2>
            <span className="contributors-count">{active.length}</span>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="contributors-body">

          {/* Active members */}
          <section className="contributors-section">
            <p className="contributors-section-label">Current</p>
            {active.length === 0 ? (
              <p className="contributors-empty">No contributors yet.</p>
            ) : (
              <ul className="contributors-list">
                {active.map(m => {
                  const isYou = m.user_id === currentUser?.id;
                  const isRoomCreator = m.user_id === currentUser?.id && isCreator;
                  return (
                    <li key={m.id} className="contributor-row">
                      <span
                        className="contributor-avatar"
                        style={{ background: m.user_color || '#6366f1' }}
                      >
                        {m.user_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="contributor-info">
                        <span className="contributor-name" style={{ color: m.user_color || '#6366f1' }}>
                          {m.user_name}
                        </span>
                        <span className="contributor-meta">
                          {m.contribution_count} contribution{m.contribution_count !== 1 ? 's' : ''}
                          {' · '}joined {formatTime(m.joined_at)}
                        </span>
                      </div>
                      <div className="contributor-badges">
                        {isYou && <span className="contributor-badge contributor-badge--you">you</span>}
                        {m.user_id === currentUser?.id && isCreator && (
                          <span className="contributor-badge contributor-badge--admin">admin</span>
                        )}
                        {!isYou && isCreator && (
                          <button
                            className="contributor-remove-btn"
                            onClick={() => onRemove(m.user_id)}
                            title="Remove from room"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Removed members — admin only */}
          {isCreator && removed.length > 0 && (
            <section className="contributors-section">
              <p className="contributors-section-label">Removed</p>
              <ul className="contributors-list contributors-list--removed">
                {removed.map(m => (
                  <li key={m.id} className="contributor-row contributor-row--removed">
                    <span
                      className="contributor-avatar"
                      style={{ background: m.user_color || '#6366f1', opacity: 0.5 }}
                    >
                      {m.user_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="contributor-info">
                      <span className="contributor-name" style={{ color: m.user_color || '#6366f1', opacity: 0.6 }}>
                        {m.user_name}
                      </span>
                      <span className="contributor-meta">
                        {m.contribution_count} contribution{m.contribution_count !== 1 ? 's' : ''}
                        {' · '}removed {formatTime(m.removed_at)}
                      </span>
                    </div>
                    <span className="contributor-badge contributor-badge--removed">Removed</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContributorsPanel;
