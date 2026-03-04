import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Link2, Check, Lock, Unlock, Users, Gamepad2,
  Grid3X3, HelpCircle, ArrowUpDown, Moon, Sun, DoorClosed, PenOff
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ExportMenu from './ExportMenu';

function RoomHeader({
  room,
  user,
  navigate,
  view,
  setView,
  handleCopyLink,
  linkCopied,
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
  const anyGameOpen = showWordle || showHangman || showWordLadder;

  const [showGameMenu, setShowGameMenu] = useState(false);
  const gameMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (gameMenuRef.current && !gameMenuRef.current.contains(e.target)) {
        setShowGameMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleGame = (setter, others) => {
    others.forEach(s => s(false));
    setter(v => !v);
    setShowGameMenu(false);
  };

  return (
    <header className="room-header">
      <div className="room-header-left">
        <button className="theme-toggle" style={{ position: 'static', marginRight: 12 }} onClick={() => navigate('/')} title="Home">
          <ArrowLeft size={18} />
        </button>
        <div className="room-title-wrap">
          <img src="/assets/logo.svg" alt="Logo" className="room-logo-img" />
          <h1 className="room-title">{room?.title || 'Untitled Room'}</h1>
          {!!room?.is_entry_locked && <span className="badge badge-locked"><DoorClosed size={12} /> Closed</span>}
          {!!room?.is_locked && <span className="badge badge-locked"><PenOff size={12} /> Locked</span>}
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
          <button
            className={`btn btn-secondary btn-icon-only${linkCopied ? ' btn--copied' : ''}`}
            onClick={handleCopyLink}
            title={linkCopied ? 'Link copied!' : 'Copy Share Link'}
          >
            {linkCopied ? <Check size={15} /> : <Link2 size={15} />}
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

        <div className="btn-group">
          <button
            className="btn btn-secondary contributors-btn"
            onClick={() => setShowContributors(true)}
            title="View contributors"
          >
            <Users size={15} /> {members.filter(m => !m.removed_at).length}
          </button>

          {/* Games dropdown */}
          <div ref={gameMenuRef} className="game-menu-wrap">
            <button
              className={`btn-icon${anyGameOpen ? ' active' : ''}`}
              onClick={() => setShowGameMenu(v => !v)}
              title="Games"
            >
              <Gamepad2 size={17} />
            </button>
            {showGameMenu && (
              <div className="game-menu-dropdown">
                <button
                  className={`game-menu-item${showWordle ? ' game-menu-item--active' : ''}`}
                  onClick={() => toggleGame(setShowWordle, [setShowHangman, setShowWordLadder])}
                >
                  <span className="game-menu-icon"><Grid3X3 size={15} /></span>
                  <span>Wordle</span>
                  {showWordle && <span className="game-menu-badge">open</span>}
                </button>
                <button
                  className={`game-menu-item${showHangman ? ' game-menu-item--active' : ''}`}
                  onClick={() => toggleGame(setShowHangman, [setShowWordle, setShowWordLadder])}
                >
                  <span className="game-menu-icon"><HelpCircle size={15} /></span>
                  <span>Hangman</span>
                  {showHangman && <span className="game-menu-badge">open</span>}
                </button>
                <button
                  className={`game-menu-item${showWordLadder ? ' game-menu-item--active' : ''}`}
                  onClick={() => toggleGame(setShowWordLadder, [setShowWordle, setShowHangman])}
                >
                  <span className="game-menu-icon"><ArrowUpDown size={15} /></span>
                  <span>Word Ladder</span>
                  {showWordLadder && <span className="game-menu-badge">open</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {isCreator && (
          <div className="view-toggle">
            <button
              className={`toggle-btn ${room?.is_entry_locked ? 'active' : ''}`}
              onClick={handleEntryLockToggle}
              title={room?.is_entry_locked ? 'Room closed — click to open' : 'Room open — click to lock'}
            >
              {room?.is_entry_locked
                ? <><Lock size={13} /> <span className="btn-long">Closed</span></>
                : <><Unlock size={13} /> <span className="btn-long">Room</span></>}
            </button>
            <button
              className={`toggle-btn ${room?.is_locked ? 'active' : ''}`}
              onClick={handleContribLockToggle}
              title={room?.is_locked ? 'Posts locked — click to unlock' : 'Posts open — click to lock'}
            >
              {room?.is_locked
                ? <><Lock size={13} /> <span className="btn-long">Locked</span></>
                : <><Unlock size={13} /> <span className="btn-long">Posts</span></>}
            </button>
          </div>
        )}
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
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
