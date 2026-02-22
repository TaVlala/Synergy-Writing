import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '../App';
import ChatView from '../components/ChatView';
import DocumentView from '../components/DocumentView';
import ReviewView from '../components/ReviewView';
import ChatSidebar from '../components/ChatSidebar';
import ContributorsPanel from '../components/ContributorsPanel';
import NotificationBell from '../components/NotificationBell';
import { USER_COLORS } from '../utils';

function Room() {
  const { id: roomId } = useParams();
  const { user, login, theme, toggleTheme } = useUser();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [view, setView] = useState('collab');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [joinColor, setJoinColor] = useState(USER_COLORS[5]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [members, setMembers] = useState([]);
  const [showContributors, setShowContributors] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null); // null | 'removed' | 'entry_locked'

  const socketRef = useRef(null);
  const typingTimerRef = useRef({});
  const bottomRef = useRef(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

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

    socket.on('contribution_updated', (updated) => {
      setContributions(prev =>
        prev.map(c => c.id === updated.id ? { ...c, content: updated.content, edited_at: updated.edited_at } : c)
      );
    });

    socket.on('contribution_status_changed', (updated) => {
      setContributions(prev =>
        prev.map(c => c.id === updated.id ? { ...c, status: updated.status, sort_order: updated.sort_order } : c)
      );
    });

    socket.on('contributions_reordered', (updates) => {
      setContributions(prev => {
        const orderMap = Object.fromEntries(updates.map(u => [u.id, u.sort_order]));
        return prev.map(c => orderMap[c.id] !== undefined ? { ...c, sort_order: orderMap[c.id] } : c);
      });
    });

    socket.on('member_joined', (member) => {
      setMembers(prev => {
        if (prev.find(m => m.user_id === member.user_id)) return prev;
        return [...prev, { ...member, contribution_count: 0, joined_at: Date.now() }];
      });
    });

    socket.on('member_removed', ({ user_id: removedId }) => {
      setMembers(prev => prev.map(m =>
        m.user_id === removedId ? { ...m, removed_at: Date.now() } : m
      ));
      // Check against the current user — use a ref so we don't capture stale user
      if (userRef.current?.id === removedId) {
        setMembershipStatus('removed');
      }
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

    socket.on('new_chat_message', (message) => {
      setChatMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
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

  // Load room, contributions, and chat history
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then(r => {
        if (!r.ok) throw new Error('Room not found');
        return r.json();
      }),
      fetch(`/api/rooms/${roomId}/contributions`).then(r => r.json()),
      fetch(`/api/rooms/${roomId}/chat`).then(r => r.json())
    ])
      .then(([roomData, contribData, chatData]) => {
        setRoom(roomData);
        setContributions(contribData);
        setChatMessages(chatData);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [roomId]);

  // Join room + load members once both user and room data are available
  useEffect(() => {
    if (!user || !roomId) return;
    const joinAndLoadMembers = async () => {
      try {
        const joinRes = await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, user_name: user.name, user_color: user.color })
        });
        if (!joinRes.ok) {
          const err = await joinRes.json();
          if (err.reason === 'removed') setMembershipStatus('removed');
          else if (err.reason === 'entry_locked') setMembershipStatus('entry_locked');
          return;
        }
      } catch { /* ignore network errors */ }

      try {
        const membersRes = await fetch(`/api/rooms/${roomId}/members`);
        const membersData = await membersRes.json();
        setMembers(membersData);
      } catch { /* ignore */ }
    };
    joinAndLoadMembers();
  }, [user, roomId]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    fetch(`/api/notifications?user_id=${user.id}`)
      .then(r => r.json())
      .then(setNotifications)
      .catch(() => {});
  }, [user]);

  // Auto-scroll contributions in collab view
  useEffect(() => {
    if (view === 'collab') {
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
          author_color: user.color || USER_COLORS[5],
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

  const handleEditContribution = async (id, newContent) => {
    const res = await fetch(`/api/contributions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, content: newContent })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to edit');
    }
  };

  const handleApproveContribution = async (id) => {
    await fetch(`/api/contributions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, status: 'approved' })
    });
  };

  const handleRejectContribution = async (id) => {
    await fetch(`/api/contributions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, status: 'rejected' })
    });
  };

  const handleReorderContributions = async (orderedIds) => {
    await fetch(`/api/rooms/${roomId}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, order: orderedIds })
    });
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

  const handleSendChat = async (content) => {
    if (!user) return;
    await fetch(`/api/rooms/${roomId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: user.id,
        author_name: user.name,
        author_color: user.color || USER_COLORS[5],
        content
      })
    });
  };

  const handleContribLockToggle = async () => {
    if (!user || !room) return;
    await fetch(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_locked: !room.is_locked })
    });
  };

  const handleEntryLockToggle = async () => {
    if (!user || !room) return;
    await fetch(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_entry_locked: !room.is_entry_locked })
    });
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!user || !isCreator) return;
    if (!window.confirm('Remove this contributor from the room?')) return;
    await fetch(`/api/rooms/${roomId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    // Refresh members
    const res = await fetch(`/api/rooms/${roomId}/members`);
    setMembers(await res.json());
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
    // If room is entry-locked, block new visitors entirely
    if (room?.is_entry_locked) {
      return (
        <div className="overlay">
          <div className="prompt-card">
            <div className="prompt-icon">🔒</div>
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
          <div className="prompt-icon">✍️</div>
          <h2>Enter your name to join</h2>
          <p>You'll be able to read and contribute to this room.</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!nameInput.trim()) return;
            await login(nameInput.trim(), undefined, joinColor);
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
                {USER_COLORS.map(c => (
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

  // Membership gate — show if authenticated user was removed or locked out
  if (membershipStatus === 'removed') {
    return (
      <div className="error-screen">
        <h2>You've been removed</h2>
        <p>The room admin has removed you from this room.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (membershipStatus === 'entry_locked') {
    return (
      <div className="error-screen">
        <h2>Room is closed</h2>
        <p>This room is no longer accepting new contributors.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const isCreator = room?.creator_id === user?.id;

  // Collab view: show pending + approved; also show own rejected so author knows
  const collabContributions = contributions.filter(c =>
    c.status !== 'rejected' || c.author_id === user?.id || isCreator
  );

  // Document view: only approved, sorted by sort_order ascending
  const documentContributions = contributions
    .filter(c => (c.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order || a.created_at) - (b.sort_order || b.created_at));

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
            {!!room?.is_entry_locked && <span className="badge badge-locked">🚪 Closed</span>}
            {!!room?.is_locked && <span className="badge badge-locked">✏️ Locked</span>}
          </div>
        </div>

        <div className="room-header-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${view === 'collab' ? 'active' : ''}`}
              onClick={() => setView('collab')}
            >
              Collab
            </button>
            <button
              className={`toggle-btn ${view === 'review' ? 'active' : ''}`}
              onClick={() => setView('review')}
            >
              Review
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
          {/* Contributors button — visible to everyone */}
          <button
            className="btn btn-secondary contributors-btn"
            onClick={() => setShowContributors(true)}
            title="View contributors"
          >
            👥 {members.filter(m => !m.removed_at).length}
          </button>

          {isCreator && (
            <>
              <button
                className={`btn lock-btn ${room?.is_entry_locked ? 'lock-btn--active' : ''}`}
                onClick={handleEntryLockToggle}
                title={room?.is_entry_locked ? 'Entry locked — click to open' : 'Entry open — click to lock'}
              >
                {room?.is_entry_locked ? '🚪 Closed' : '🚪 Open'}
              </button>
              <button
                className={`btn lock-btn ${room?.is_locked ? 'lock-btn--active' : ''}`}
                onClick={handleContribLockToggle}
                title={room?.is_locked ? 'Posts locked — click to unlock' : 'Posts open — click to lock'}
              >
                {room?.is_locked ? '✏️ Locked' : '✏️ Posts'}
              </button>
            </>
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

      {/* ── Body: contributions + chat sidebar ── */}
      <div className="room-body">
        <main className="room-main">
          {view === 'collab' && (
            <ChatView
              contributions={collabContributions}
              currentUser={user}
              isCreator={isCreator}
              onDelete={handleDeleteContribution}
              onEdit={handleEditContribution}
              onReact={handleReaction}
              onAddComment={handleAddComment}
              onLoadComments={handleLoadComments}
            />
          )}
          {view === 'review' && (
            <ReviewView
              contributions={contributions}
              currentUser={user}
              isCreator={isCreator}
              onApprove={handleApproveContribution}
              onReject={handleRejectContribution}
              onReorder={handleReorderContributions}
            />
          )}
          {view === 'document' && (
            <DocumentView
              contributions={documentContributions}
              roomTitle={room?.title}
            />
          )}
          <div ref={bottomRef} />
        </main>

        {view === 'collab' && (
          <ChatSidebar
            messages={chatMessages}
            currentUser={user}
            onSend={handleSendChat}
            isOpen={chatOpen}
            onToggle={() => setChatOpen(o => !o)}
          />
        )}
      </div>

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
      {view === 'collab' && (
        room?.is_locked ? (
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
        )
      )}

      {/* Contributors panel */}
      {showContributors && (
        <ContributorsPanel
          members={members}
          isCreator={isCreator}
          currentUser={user}
          onRemove={handleRemoveMember}
          onClose={() => setShowContributors(false)}
        />
      )}
    </div>
  );
}

export default Room;
