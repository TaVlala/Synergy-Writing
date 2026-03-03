import React from 'react';
import NotificationBell from './NotificationBell';
import ExportMenu from './ExportMenu';

function RoomHeader({
  room,
  user,
  navigate,
  view,
  setView,
  handleCopyLink,
  showExportMenu,
  setShowExportMenu,
  handleExportTxt,
  handleExportPdf,
  handleExportDocx,
  handleExportEpub,
  exportMenuRef,
  onlineUsers,
  members,
  showWordle,
  setShowWordle,
  showHangman,
  setShowHangman,
  showWordLadder,
  setShowWordLadder,
  setShowContributors,
  handleEntryLockToggle,
  handleContribLockToggle,
  toggleTheme,
  theme,
  notifications,
  markAllNotificationsRead
}) {
  const isCreator = room?.creator_id && user?.id && room.creator_id === user.id;

  return (
    <header className="room-header">
      <div className="room-header-left">
        <button className="theme-toggle" style={{ position: 'static', marginRight: 12 }} onClick={() => navigate('/')} title="Home">
          ←
        </button>
        <div className="room-title-wrap">
          <img src="/assets/logo.svg" alt="Logo" className="room-logo-img" />
          <h1 className="room-title">{room?.title || 'Untitled Room'}</h1>
          {!!room?.is_entry_locked && <span className="badge badge-locked">🚪 Closed</span>}
          {!!room?.is_locked && <span className="badge badge-locked">✏️ Locked</span>}
        </div>
      </div>

      <div className="room-header-center">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'collab' ? 'active' : ''}`}
            onClick={() => setView('collab')}
            title="Collaboration Feed"
          >
            <span className="btn-long">Collab</span>
            <span className="btn-short">C</span>
          </button>
          <button
            className={`toggle-btn ${view === 'review' ? 'active' : ''}`}
            onClick={() => setView('review')}
            title="Review & Approve"
          >
            <span className="btn-long">Review</span>
            <span className="btn-short">R</span>
          </button>
          <button
            className={`toggle-btn ${view === 'document' ? 'active' : ''}`}
            onClick={() => setView('document')}
            title="Final Document"
          >
            <span className="btn-long">Document</span>
            <span className="btn-short">D</span>
          </button>
        </div>
      </div>

      <div className="room-header-right">
        <div className="btn-group">
          <button className="btn btn-secondary btn-icon-only" onClick={handleCopyLink} title="Copy Share Link">
            🔗
          </button>
          <ExportMenu
            show={showExportMenu}
            onToggle={setShowExportMenu}
            onExportTxt={handleExportTxt}
            onExportPdf={handleExportPdf}
            onExportDocx={handleExportDocx}
            onExportEpub={handleExportEpub}
            menuRef={exportMenuRef}
          />
        </div>

        {Array.isArray(onlineUsers) && onlineUsers.length > 0 && (
          <div className="presence-avatars">
            {onlineUsers.slice(0, 5).map(u => (
              <span
                key={u.userId}
                className={`presence-avatar${u.userId === user?.id ? ' presence-avatar--self' : ''}`}
                style={{ background: u.userColor }}
                title={u.userId === user?.id ? `${u.userName || 'Unknown'} (you)` : u.userName || 'Unknown'}
              >
                {(u.userName || '?').charAt(0).toUpperCase()}
              </span>
            ))}
            {onlineUsers.length > 5 && (
              <span className="presence-overflow" title={`${onlineUsers.length - 5} more online`}>
                +{onlineUsers.length - 5}
              </span>
            )}
          </div>
        )}

        <div className="btn-group">
          <button
            className="btn btn-secondary contributors-btn"
            onClick={() => setShowContributors(true)}
            title="View contributors"
          >
            👥 {members.filter(m => !m.removed_at).length}
          </button>
          <button
            className={`btn-icon${showWordle ? ' active' : ''}`}
            onClick={() => setShowWordle(v => !v)}
            title="Play Wordle"
          >
            🎮
          </button>
          <button
            className={`btn-icon${showHangman ? ' active' : ''}`}
            onClick={() => setShowHangman(v => !v)}
            title="Play Hangman"
          >
            🎭
          </button>
          <button
            className={`btn-icon${showWordLadder ? ' active' : ''}`}
            onClick={() => setShowWordLadder(v => !v)}
            title="Play Word Ladder"
          >
            🪜
          </button>
        </div>

        {isCreator && (
          <div className="view-toggle">
            <button
              className={`toggle-btn ${room?.is_entry_locked ? 'active' : ''}`}
              onClick={handleEntryLockToggle}
              title={room?.is_entry_locked ? 'Room closed — click to open' : 'Room open — click to lock'}
            >
              {room?.is_entry_locked ? '🔒 Closed' : '🔓 Room'}
            </button>
            <button
              className={`toggle-btn ${room?.is_locked ? 'active' : ''}`}
              onClick={handleContribLockToggle}
              title={room?.is_locked ? 'Posts locked — click to unlock' : 'Posts open — click to lock'}
            >
              {room?.is_locked ? '🔒 Locked' : '🔓 Posts'}
            </button>
          </div>
        )}
        <button className="btn-icon" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <NotificationBell
          notifications={notifications}
          onMarkAllRead={markAllNotificationsRead}
        />
      </div>
    </header>
  );
}

export default React.memo(RoomHeader);
