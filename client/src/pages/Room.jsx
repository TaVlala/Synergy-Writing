import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '../App';
import ChatView from '../components/ChatView';
import DocumentView from '../components/DocumentView';
import NotificationBell from '../components/NotificationBell';

function Room() {
  const { id: roomId } = useParams();
  const { user, login, theme, toggleTheme } = useUser();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [view, setView] = useState('chat');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const socketRef = useRef(null);
  const typingTimerRef = useRef({});
  const bottomRef = useRef(null);

  // Socket.io setup
  useEffect(() => {
    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', roomId);
      if (user) socket.emit('join_user', user.id);
    });

    socket.on('new_contribution', (contribution) => {
      setContributions(prev => {
        if (prev.find(c => c.id === contribution.id)) return prev;
        return [...prev, contribution];
      });
    });

    socket.on('contribution_deleted', ({ id }) => {
      setContributions(prev => prev.filter(c => c.id !== id));
    });

    socket.on('room_updated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('reactions_updated', ({ contribution_id, reactions }) => {
      setContributions(prev =>
        prev.map(c => c.id === contribution_id ? { ...c, reactions } : c)
      );
    });

    socket.on('new_comment', ({ contribution_id, comment }) => {
      setContributions(prev =>
        prev.map(c =>
          c.id === contribution_id
            ? { ...c, comments: c.comments ? [...c.comments, comment] : [comment] }
            : c
        )
      );
    });

    socket.on('notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
    });

    socket.on('user_typing', ({ userName }) => {
      setTypingUsers(prev => prev.includes(userName) ? prev : [...prev, userName]);
      clearTimeout(typingTimerRef.current[userName]);
      typingTimerRef.current[userName] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== userName));
      }, 3000);
    });

    return () => {
      socket.emit('leave_room', roomId);
      socket.disconnect();
    };
  }, [roomId]); // intentionally not including user to avoid reconnect on login

  // Join user socket room once user is available
  useEffect(() => {
    if (user && socketRef.current?.connected) {
      socketRef.current.emit('join_user', user.id);
    }
  }, [user]);

  // Load room and contributions
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then(r => {
        if (!r.ok) throw new Error('Room not found');
        return r.json();
      }),
      fetch(`/api/rooms/${roomId}/contributions`).then(r => r.json())
    ])
      .then(([roomData, contribData]) => {
        setRoom(roomData);
        setContributions(contribData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [roomId]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    fetch(`/api/notifications?user_id=${user.id}`)
      .then(r => r.json())
      .then(setNotifications)
      .catch(() => {});
  }, [user]);

  // Auto-scroll in chat view
  useEffect(() => {
    if (view === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [contributions, view]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newText.trim() || !user || submitting || room?.is_locked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: user.id,
          author_name: user.name,
          content: newText.trim()
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to post');
      }
      setNewText('');
    } catch (err) {
      alert(err.message);
    }
    setSubmitting(false);
  };

  const handleTyping = () => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId, userName: user.name });
  };

  const handleDeleteContribution = async (id) => {
    if (!window.confirm('Delete this contribution?')) return;
    await fetch(`/api/contributions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
  };

  const handleReaction = async (contributionId, emoji) => {
    if (!user) return;
    await fetch(`/api/contributions/${contributionId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, emoji })
    });
  };

  const handleAddComment = async (contributionId, content, parentId = null) => {
    if (!user || !content.trim()) return;
    const res = await fetch(`/api/contributions/${contributionId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: user.id,
        author_name: user.name,
        content: content.trim(),
        parent_id: parentId
      })
    });
    return res.json();
  };

  const handleLoadComments = async (contributionId) => {
    const res = await fetch(`/api/contributions/${contributionId}/comments`);
    const comments = await res.json();
    setContributions(prev =>
      prev.map(c => c.id === contributionId ? { ...c, comments } : c)
    );
    return comments;
  };

  const handleLockToggle = async () => {
    if (!user || !room) return;
    await fetch(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_locked: !room.is_locked })
    });
  };

  const handleExport = () => {
    const title = room?.title || 'Untitled Story';
    const lines = [
      title,
      '='.repeat(title.length),
      '',
      ...contributions.map(c =>
        `[${c.author_name} — ${new Date(c.created_at).toLocaleString()}]\n${c.content}`
      ).join('\n\n---\n\n').split('\n')
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  // Name prompt for unauthenticated users visiting a room link
  if (!user) {
    return (
      <div className="overlay">
        <div className="prompt-card">
          <div className="prompt-icon">✍️</div>
          <h2>Enter your name to join</h2>
          <p>You'll be able to read and contribute to this room.</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!nameInput.trim()) return;
            await login(nameInput.trim());
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
            <button className="btn btn-primary" type="submit" disabled={!nameInput.trim()}>
              Join Room →
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Room not found</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const isCreator = room?.creator_id === user?.id;

  return (
    <div className="room-layout">
      {/* ── Header ── */}
      <header className="room-header">
        <div className="room-header-left">
          <button className="btn-icon" onClick={() => navigate('/')} title="Home">
            ←
          </button>
          <div className="room-title-wrap">
            <h1 className="room-title">{room?.title || 'Untitled Room'}</h1>
            {!!room?.is_locked && <span className="badge badge-locked">🔒 Locked</span>}
          </div>
        </div>

        <div className="room-header-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'chat' ? 'active' : ''}`}
              onClick={() => setView('chat')}
            >
              Chat
            </button>
            <button
              className={`toggle-btn ${view === 'document' ? 'active' : ''}`}
              onClick={() => setView('document')}
            >
              Document
            </button>
          </div>

          <button className="btn btn-secondary" onClick={handleCopyLink}>
            {linkCopied ? '✓ Copied!' : '🔗 Share'}
          </button>
          <button className="btn btn-secondary" onClick={handleExport} title="Download as .txt">
            ↓ Export
          </button>
          {isCreator && (
            <button
              className={`btn ${room?.is_locked ? 'btn-success' : 'btn-warning'}`}
              onClick={handleLockToggle}
            >
              {room?.is_locked ? '🔓 Unlock' : '🔒 Lock'}
            </button>
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

      {/* ── Main ── */}
      <main className="room-main">
        {view === 'chat' ? (
          <ChatView
            contributions={contributions}
            currentUser={user}
            isCreator={isCreator}
            onDelete={handleDeleteContribution}
            onReact={handleReaction}
            onAddComment={handleAddComment}
            onLoadComments={handleLoadComments}
          />
        ) : (
          <DocumentView
            contributions={contributions}
            roomTitle={room?.title}
          />
        )}
        <div ref={bottomRef} />
      </main>

      {/* ── Typing indicator ── */}
      {typingUsers.length > 0 && (
        <div className="typing-bar">
          <span className="typing-dots">
            <span /><span /><span />
          </span>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
        </div>
      )}

      {/* ── Input footer ── */}
      {room?.is_locked ? (
        <footer className="room-footer locked-footer">
          <span>🔒 This room is locked — no new contributions can be added.</span>
        </footer>
      ) : (
        <footer className="room-footer">
          <form className="contribution-form" onSubmit={handleSubmit}>
            <textarea
              className="contribution-input"
              placeholder={`Write something, ${user.name}… (Ctrl+Enter to post)`}
              value={newText}
              onChange={e => { setNewText(e.target.value); handleTyping(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
              }}
              rows={3}
            />
            <div className="form-actions">
              <span className="form-hint">Ctrl + Enter to post</span>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting || !newText.trim()}
              >
                {submitting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>
        </footer>
      )}
    </div>
  );
}

export default Room;
