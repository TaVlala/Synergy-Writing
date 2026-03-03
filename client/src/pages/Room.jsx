<<<<<<< Updated upstream
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '../App';
import ChatView from '../components/ChatView';
import DocumentView from '../components/DocumentView';
import ReviewView from '../components/ReviewView';
import ChatSidebar from '../components/ChatSidebar';
import ContributorsPanel from '../components/ContributorsPanel';
import WordleGame from '../components/WordleGame';
import NotificationBell from '../components/NotificationBell';
import RichEditor from '../components/RichEditor';
import { USER_COLORS } from '../utils';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

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
  const [editorHTML, setEditorHTML] = useState('');
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const editorRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [nameInput, setNameInput] = useState('');
  const [joinColor, setJoinColor] = useState(USER_COLORS[5]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [showContributors, setShowContributors] = useState(false);
  const [showWordle, setShowWordle] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null); // null | 'removed' | 'entry_locked'
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [otherCursors, setOtherCursors] = useState({}); // { userId: { pos, color, name } }

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
      const u = userRef.current;
      if (u) {
        socket.emit('join_user', u.id);
        socket.emit('user_online', {
          roomId,
          userId: u.id,
          userName: u.name,
          userColor: u.color || USER_COLORS[5],
        });
      }
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
        prev.map(c => c.id === updated.id ? { ...updated, comments: c.comments } : c)
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

    socket.on('presence_update', (users) => {
      setOnlineUsers(users);
      // Clean up cursors for users who went offline
      setOtherCursors(prev => {
        const next = { ...prev };
        const onlineIds = new Set(users.map(u => u.userId));
        Object.keys(next).forEach(id => {
          if (!onlineIds.has(id)) delete next[id];
        });
        return next;
      });
    });

    socket.on('cursor_update', ({ userId, userName, userColor, position }) => {
      setOtherCursors(prev => ({
        ...prev,
        [userId]: { position, color: userColor, name: userName }
      }));
    });

    return () => {
      socket.emit('leave_room', roomId);
      socket.disconnect();
    };
  }, [roomId]); // intentionally not including user to avoid reconnect on login

  // Join user socket room + register presence once user is available
  useEffect(() => {
    if (user && socketRef.current?.connected) {
      socketRef.current.emit('join_user', user.id);
      socketRef.current.emit('user_online', {
        roomId,
        userId: user.id,
        userName: user.name,
        userColor: user.color || USER_COLORS[5],
      });
    }
  }, [user]);

  // Load room, contributions, and chat history
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then(r => {
        if (!r.ok) throw new Error(`Room fetch failed: ${r.status}`);
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
      .catch(err => {
        console.error('Room loading error:', err);
        setError(err.message);
      })
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
      .catch(() => { });
  }, [user]);

  // Auto-scroll contributions in collab view
  useEffect(() => {
    if (view === 'collab') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [contributions, view]);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (editorEmpty || !user || submitting || room?.is_locked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: user.id,
          author_name: user.name,
          author_color: user.color || USER_COLORS[5],
          content: editorHTML
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to post');
      }
      editorRef.current?.clearContent();
      setEditorHTML('');
      setEditorEmpty(true);
    } catch (err) {
      setPostError(err.message);
      setTimeout(() => setPostError(''), 4000);
    }
    setSubmitting(false);
  };

  const handleTyping = () => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId, userName: user.name });
  };

  const handleCursorUpdate = (position) => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('cursor_update', {
      roomId,
      userId: user.id,
      userName: user.name,
      userColor: user.color || USER_COLORS[5],
      position
    });
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

  const handlePinContribution = async (id, pinned) => {
    const res = await fetch(`/api/rooms/${roomId}/contributions/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, pinned })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to pin');
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

  const handleDeleteContribution = (id) => {
    setConfirmDialog({
      message: 'Delete this contribution?',
      onConfirm: async () => {
        await fetch(`/api/contributions/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
      }
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

  const handleAddComment = async (contributionId, content, parentId = null, inlineId = null) => {
    if (!user || !content.trim()) return;
    const res = await fetch(`/api/contributions/${contributionId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: user.id,
        author_name: user.name,
        content: content.trim(),
        parent_id: parentId,
        inline_id: inlineId
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

  const handleRemoveMember = (targetUserId) => {
    if (!user || !isCreator) return;
    setConfirmDialog({
      message: 'Remove this contributor from the room?',
      onConfirm: async () => {
        await fetch(`/api/rooms/${roomId}/members/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        const res = await fetch(`/api/rooms/${roomId}/members`);
        setMembers(await res.json());
      }
    });
  };

  const stripHTML = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const handleExportTxt = () => {
    const title = room?.title || 'Untitled Story';
    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));
    const content = approved.map(c => stripHTML(c.content)).join('\n\n');
    const fullText = `${title}\n${'='.repeat(title.length)}\n\n${content}`;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const title = room?.title || 'Untitled Story';
    const doc = new jsPDF();

    // Title
    doc.setFontSize(22);
    doc.text(title, 20, 20);

    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    let y = 40;

    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    approved.forEach(c => {
      const splitContent = doc.splitTextToSize(stripHTML(c.content), 170);
      doc.text(splitContent, 20, y);
      y += (splitContent.length * 7) + 8;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
    setShowExportMenu(false);
  };

  const handleExportDocx = () => {
    const title = room?.title || 'Untitled Story';

    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    const children = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    ];

    approved.forEach(c => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripHTML(c.content) })],
          spacing: { after: 200 },
        }),
      );
    });

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
    });
    setShowExportMenu(false);
  };

  const handleExportEpub = async () => {
    const title = room?.title || 'Untitled Story';
    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    // EPUB uses server-side generation (epub-gen-memory needs Node.js path/fs internals)
    const bodyHtml = approved.map(c => `<p>${stripHTML(c.content)}</p>`).join('\n');
    const chapters = [{ title, content: bodyHtml || '<p> </p>' }];

    try {
      const res = await fetch(`/api/rooms/${roomId}/export/epub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, chapters }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`);
    } catch (err) {
      console.error('EPUB Export failed:', err);
    }
    setShowExportMenu(false);
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

  const isCreator = room?.creator_id && user?.id && room.creator_id === user.id;

  // Collab view: show pending + approved; also show own rejected so author knows
  const collabContributions = (Array.isArray(contributions) ? contributions : []).filter(c =>
    c.status !== 'rejected' || (user?.id && c.author_id === user.id) || isCreator
  );

  // Document view: only approved, sorted by sort_order ascending
  const documentContributions = (Array.isArray(contributions) ? contributions : [])
    .filter(c => (c.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order || a.created_at) - (b.sort_order || b.created_at));

  return (
    <div className="room-layout">
      {/* ── Header ── */}
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
            <div className="export-menu-wrap" ref={exportMenuRef}>
              <button
                className={`btn btn-secondary btn-icon-only ${showExportMenu ? 'active' : ''}`}
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Document"
              >
                ↓
              </button>
              {showExportMenu && (
                <div className="export-dropdown">
                  <button onClick={handleExportTxt} className="export-item">
                    <span className="export-icon">📄</span>
                    <div className="export-info">
                      <span className="export-label">Plain Text</span>
                      <span className="export-ext">.txt</span>
                    </div>
                  </button>
                  <button onClick={handleExportPdf} className="export-item">
                    <span className="export-icon">📕</span>
                    <div className="export-info">
                      <span className="export-label">PDF Document</span>
                      <span className="export-ext">.pdf</span>
                    </div>
                  </button>
                  <button onClick={handleExportDocx} className="export-item">
                    <span className="export-icon">📘</span>
                    <div className="export-info">
                      <span className="export-label">Word Document</span>
                      <span className="export-ext">.docx</span>
                    </div>
                  </button>
                  <button onClick={handleExportEpub} className="export-item">
                    <span className="export-icon">📙</span>
                    <div className="export-info">
                      <span className="export-label">EPUB Book</span>
                      <span className="export-ext">.epub</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Online presence avatars */}
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

          {/* Contributors & Viewers Group */}
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
              onPin={handlePinContribution}
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
            messages={Array.isArray(chatMessages) ? chatMessages : []}
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
              <RichEditor
                ref={editorRef}
                placeholder={`Write something, ${user?.name || 'Contributor'}…`}
                otherCursors={otherCursors}
                currentUserName={user?.name}
                onChange={(html, isEmpty) => {
                  setEditorHTML(html);
                  setEditorEmpty(isEmpty);
                  handleTyping();
                }}
                onSelectionUpdate={handleCursorUpdate}
                onSubmit={handleSubmit}
              />
              <div className="form-actions">
                <span className="form-hint">Ctrl + Enter to post</span>
                {postError && <span className="form-error">{postError}</span>}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={submitting || editorEmpty}
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

      {/* Wordle game panel */}
      {showWordle && <WordleGame onClose={() => setShowWordle(false)} />}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;
=======
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useUser } from '../App';
import ChatView from '../components/ChatView';
import DocumentView from '../components/DocumentView';
import ReviewView from '../components/ReviewView';
import ChatSidebar from '../components/ChatSidebar';
import ContributorsPanel from '../components/ContributorsPanel';
import WordleGame from '../components/WordleGame';
import NotificationBell from '../components/NotificationBell';
import RichEditor from '../components/RichEditor';
import { USER_COLORS } from '../utils';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

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
  const [editorHTML, setEditorHTML] = useState('');
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
  const editorRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [nameInput, setNameInput] = useState('');
  const [joinColor, setJoinColor] = useState(USER_COLORS[5]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [showContributors, setShowContributors] = useState(false);
  const [showWordle, setShowWordle] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState(null); // null | 'removed' | 'entry_locked'
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [otherCursors, setOtherCursors] = useState({}); // { userId: { pos, color, name } }

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
      const u = userRef.current;
      if (u) {
        socket.emit('join_user', u.id);
        socket.emit('user_online', {
          roomId,
          userId: u.id,
          userName: u.name,
          userColor: u.color || USER_COLORS[5],
        });
      }
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
        prev.map(c => c.id === updated.id ? { ...updated, comments: c.comments } : c)
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

    socket.on('presence_update', (users) => {
      setOnlineUsers(users);
      // Clean up cursors for users who went offline
      setOtherCursors(prev => {
        const next = { ...prev };
        const onlineIds = new Set(users.map(u => u.userId));
        Object.keys(next).forEach(id => {
          if (!onlineIds.has(id)) delete next[id];
        });
        return next;
      });
    });

    socket.on('cursor_update', ({ userId, userName, userColor, position }) => {
      setOtherCursors(prev => ({
        ...prev,
        [userId]: { position, color: userColor, name: userName }
      }));
    });

    return () => {
      socket.emit('leave_room', roomId);
      socket.disconnect();
    };
  }, [roomId]); // intentionally not including user to avoid reconnect on login

  // Join user socket room + register presence once user is available
  useEffect(() => {
    if (user && socketRef.current?.connected) {
      socketRef.current.emit('join_user', user.id);
      socketRef.current.emit('user_online', {
        roomId,
        userId: user.id,
        userName: user.name,
        userColor: user.color || USER_COLORS[5],
      });
    }
  }, [user]);

  // Load room, contributions, and chat history
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`/api/rooms/${roomId}`).then(r => {
        if (!r.ok) throw new Error(`Room fetch failed: ${r.status}`);
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
      .catch(err => {
        console.error('Room loading error:', err);
        setError(err.message);
      })
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
      .catch(() => { });
  }, [user]);

  // Auto-scroll contributions in collab view
  useEffect(() => {
    if (view === 'collab') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [contributions, view]);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (editorEmpty || !user || submitting || room?.is_locked) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_id: user.id,
          author_name: user.name,
          author_color: user.color || USER_COLORS[5],
          content: editorHTML
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to post');
      }
      editorRef.current?.clearContent();
      setEditorHTML('');
      setEditorEmpty(true);
    } catch (err) {
      setPostError(err.message);
      setTimeout(() => setPostError(''), 4000);
    }
    setSubmitting(false);
  };

  const handleTyping = () => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId, userName: user.name });
  };

  const handleCursorUpdate = (position) => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('cursor_update', {
      roomId,
      userId: user.id,
      userName: user.name,
      userColor: user.color || USER_COLORS[5],
      position
    });
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

  const handlePinContribution = async (id, pinned) => {
    const res = await fetch(`/api/rooms/${roomId}/contributions/${id}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, pinned })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to pin');
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

  const handleDeleteContribution = (id) => {
    setConfirmDialog({
      message: 'Delete this contribution?',
      onConfirm: async () => {
        await fetch(`/api/contributions/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
      }
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

  const handleAddComment = async (contributionId, content, parentId = null, inlineId = null) => {
    if (!user || !content.trim()) return;
    const res = await fetch(`/api/contributions/${contributionId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_id: user.id,
        author_name: user.name,
        content: content.trim(),
        parent_id: parentId,
        inline_id: inlineId
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

  const handleRemoveMember = (targetUserId) => {
    if (!user || !isCreator) return;
    setConfirmDialog({
      message: 'Remove this contributor from the room?',
      onConfirm: async () => {
        await fetch(`/api/rooms/${roomId}/members/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        const res = await fetch(`/api/rooms/${roomId}/members`);
        setMembers(await res.json());
      }
    });
  };

  const stripHTML = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  const handleExportTxt = () => {
    const title = room?.title || 'Untitled Story';
    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));
    const content = approved.map(c => stripHTML(c.content)).join('\n\n');
    const fullText = `${title}\n${'='.repeat(title.length)}\n\n${content}`;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const title = room?.title || 'Untitled Story';
    const doc = new jsPDF();

    // Title
    doc.setFontSize(22);
    doc.text(title, 20, 20);

    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    let y = 40;

    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    approved.forEach(c => {
      const splitContent = doc.splitTextToSize(stripHTML(c.content), 170);
      doc.text(splitContent, 20, y);
      y += (splitContent.length * 7) + 8;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
    setShowExportMenu(false);
  };

  const handleExportDocx = () => {
    const title = room?.title || 'Untitled Story';

    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    const children = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    ];

    approved.forEach(c => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripHTML(c.content) })],
          spacing: { after: 200 },
        }),
      );
    });

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
    });
    setShowExportMenu(false);
  };

  const handleExportEpub = async () => {
    const title = room?.title || 'Untitled Story';
    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    // EPUB uses server-side generation (epub-gen-memory needs Node.js path/fs internals)
    const bodyHtml = approved.map(c => `<p>${stripHTML(c.content)}</p>`).join('\n');
    const chapters = [{ title, content: bodyHtml || '<p> </p>' }];

    try {
      const res = await fetch(`/api/rooms/${roomId}/export/epub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, chapters }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`);
    } catch (err) {
      console.error('EPUB Export failed:', err);
    }
    setShowExportMenu(false);
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

  const isCreator = room?.creator_id && user?.id && room.creator_id === user.id;

  // Collab view: show pending + approved; also show own rejected so author knows
  const collabContributions = (Array.isArray(contributions) ? contributions : []).filter(c =>
    c.status !== 'rejected' || (user?.id && c.author_id === user.id) || isCreator
  );

  // Document view: only approved, sorted by sort_order ascending
  const documentContributions = (Array.isArray(contributions) ? contributions : [])
    .filter(c => (c.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order || a.created_at) - (b.sort_order || b.created_at));

  return (
    <div className="room-layout">
      {/* ── Header ── */}
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
            <div className="export-menu-wrap" ref={exportMenuRef}>
              <button
                className={`btn btn-secondary btn-icon-only ${showExportMenu ? 'active' : ''}`}
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export Document"
              >
                ↓
              </button>
              {showExportMenu && (
                <div className="export-dropdown">
                  <button onClick={handleExportTxt} className="export-item">
                    <span className="export-icon">📄</span>
                    <div className="export-info">
                      <span className="export-label">Plain Text</span>
                      <span className="export-ext">.txt</span>
                    </div>
                  </button>
                  <button onClick={handleExportPdf} className="export-item">
                    <span className="export-icon">📕</span>
                    <div className="export-info">
                      <span className="export-label">PDF Document</span>
                      <span className="export-ext">.pdf</span>
                    </div>
                  </button>
                  <button onClick={handleExportDocx} className="export-item">
                    <span className="export-icon">📘</span>
                    <div className="export-info">
                      <span className="export-label">Word Document</span>
                      <span className="export-ext">.docx</span>
                    </div>
                  </button>
                  <button onClick={handleExportEpub} className="export-item">
                    <span className="export-icon">📙</span>
                    <div className="export-info">
                      <span className="export-label">EPUB Book</span>
                      <span className="export-ext">.epub</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Online presence avatars */}
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

          {/* Contributors & Viewers Group */}
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
              onPin={handlePinContribution}
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
            messages={Array.isArray(chatMessages) ? chatMessages : []}
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
              <RichEditor
                ref={editorRef}
                placeholder={`Write something, ${user?.name || 'Contributor'}…`}
                otherCursors={otherCursors}
                currentUserName={user?.name}
                onChange={(html, isEmpty) => {
                  setEditorHTML(html);
                  setEditorEmpty(isEmpty);
                  handleTyping();
                }}
                onSelectionUpdate={handleCursorUpdate}
                onSubmit={handleSubmit}
              />
              <div className="form-actions">
                <span className="form-hint">Ctrl + Enter to post</span>
                {postError && <span className="form-error">{postError}</span>}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={submitting || editorEmpty}
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

      {/* Wordle game panel */}
      {showWordle && <WordleGame onClose={() => setShowWordle(false)} />}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;
>>>>>>> Stashed changes
