import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Lock, Swords } from 'lucide-react';
import { useUser } from '../App';
import { APP_COLORS, stripHTML, sanitizeRichHtml } from '../utils';
import ChatView from '../components/ChatView';
import DocumentView from '../components/DocumentView';
import ReviewView from '../components/ReviewView';
import NotificationBell from '../components/NotificationBell';
import RichEditor from '../components/RichEditor';
import CommentSection from '../components/CommentSection';
import RoomHeader from '../components/RoomHeader';
import SidebarComponent from '../components/SidebarComponent';

// Lazy load heavy/non-critical components
const ChatSidebar = React.lazy(() => import('../components/ChatSidebar'));
const ContributorsPanel = React.lazy(() => import('../components/ContributorsPanel'));
const WordleGame = React.lazy(() => import('../components/WordleGame'));
const HangmanGame = React.lazy(() => import('../components/HangmanGame'));
const WordLadder = React.lazy(() => import('../components/WordLadder'));

function Room() {
  const { id: roomId } = useParams();
  const { user, apiFetch, authToken, theme, toggleTheme } = useUser();
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
  const [joinColor, setJoinColor] = useState(APP_COLORS[5]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [showContributors, setShowContributors] = useState(false);
  const [showWordle, setShowWordle] = useState(false);
  const [showHangman, setShowHangman] = useState(false);
  const [showWordLadder, setShowWordLadder] = useState(false);
  // 1v1 game challenge state
  const [incomingChallenge, setIncomingChallenge] = useState(null); // { challengeId, game, seed, fromUser }
  const [gameSession, setGameSession] = useState(null);             // { game, seed, opponentName, opponentId }
  const [opponentResult, setOpponentResult] = useState(null);       // { outcome, score }
  const [challengeMsg, setChallengeMsg] = useState('');             // "X declined" feedback
  const [membershipStatus, setMembershipStatus] = useState(null); // null | 'removed' | 'entry_locked'
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [otherCursors, setOtherCursors] = useState({}); // { userId: { pos, color, name } }
  const [activeCommentId, setActiveCommentId] = useState(null); // ID of contribution whose comments are shown in sidebar

  const socketRef = useRef(null);
  const typingTimerRef = useRef({});
  const bottomRef = useRef(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Socket.io setup
  useEffect(() => {
    if (!authToken) return;
    const socket = io({
      auth: { token: authToken },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
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
          userColor: u.color || APP_COLORS[5],
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

    // ── Game challenge events ───────────────────────────────────────────
    socket.on('game:challenge:received', (challenge) => {
      setIncomingChallenge(challenge);
    });

    socket.on('game:challenge:accepted', ({ game, seed, opponentName, opponentId, customWord }) => {
      setGameSession(prev => {
        // If already set up as setter for this game, just confirm opponent info (don't overwrite role/customWord)
        if (prev && prev.game === game && prev.role === 'setter') {
          return { ...prev, opponentName, opponentId };
        }
        return { game, seed, opponentName, opponentId, role: game === 'hangman' ? 'setter' : 'player', customWord };
      });
      setOpponentResult(null);
      if (game === 'wordle')     setShowWordle(true);
      if (game === 'hangman')    setShowHangman(true);
      if (game === 'wordladder') setShowWordLadder(true);
    });

    socket.on('game:challenge:declined', ({ opponentName }) => {
      setGameSession(null);
      setChallengeMsg(`${opponentName} declined the challenge`);
      setTimeout(() => setChallengeMsg(''), 3500);
    });

    socket.on('game:opponent:result', ({ result }) => {
      setOpponentResult(result);
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
        userColor: user.color || APP_COLORS[5],
      });
    }
  }, [user]);

  // Load room, contributions, and chat history
  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch(`/api/rooms/${roomId}`).then(r => {
        if (!r.ok) throw new Error(`Room fetch failed: ${r.status}`);
        return r.json();
      }),
      apiFetch(`/api/rooms/${roomId}/contributions`).then(r => r.json()),
      apiFetch(`/api/rooms/${roomId}/chat`).then(r => r.json())
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
        const joinRes = await apiFetch(`/api/rooms/${roomId}/join`, {
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
        const membersRes = await apiFetch(`/api/rooms/${roomId}/members`);
        const membersData = await membersRes.json();
        setMembers(membersData);
      } catch { /* ignore */ }
    };
    joinAndLoadMembers();
  }, [user, roomId]);

  // Load notifications
  useEffect(() => {
    if (!user) return;
    apiFetch(`/api/notifications?user_id=${user.id}`)
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
      const res = await apiFetch(`/api/rooms/${roomId}/contributions`, {
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
    const res = await apiFetch(`/api/contributions/${id}`, {
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
    const res = await apiFetch(`/api/rooms/${roomId}/contributions/${id}/pin`, {
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
    await apiFetch(`/api/contributions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, status: 'approved' })
    });
  };

  const handleRejectContribution = async (id) => {
    await apiFetch(`/api/contributions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, status: 'rejected' })
    });
  };

  const handleReorderContributions = async (orderedIds) => {
    await apiFetch(`/api/rooms/${roomId}/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, order: orderedIds })
    });
  };

  const handleDeleteContribution = (id) => {
    setConfirmDialog({
      message: 'Delete this contribution?',
      onConfirm: async () => {
        await apiFetch(`/api/contributions/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
      }
    });
  };

  const handleReaction = async (contributionId, emoji) => {
    if (!user) return;
    await apiFetch(`/api/contributions/${contributionId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, emoji })
    });
  };

  const handleAddComment = async (contributionId, content, parentId = null, inlineId = null) => {
    if (!user || !content.trim()) return;
    const res = await apiFetch(`/api/contributions/${contributionId}/comments`, {
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
    const res = await apiFetch(`/api/contributions/${contributionId}/comments`);
    const comments = await res.json();
    setContributions(prev =>
      prev.map(c => c.id === contributionId ? { ...c, comments } : c)
    );
    return comments;
  };

  const handleSendChat = async (content) => {
    if (!user) return;
    await apiFetch(`/api/rooms/${roomId}/chat`, {
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
    await apiFetch(`/api/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_locked: !room.is_locked })
    });
  };

  const handleEntryLockToggle = async () => {
    if (!user || !room) return;
    await apiFetch(`/api/rooms/${roomId}`, {
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
        await apiFetch(`/api/rooms/${roomId}/members/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });
        const res = await apiFetch(`/api/rooms/${roomId}/members`);
        setMembers(await res.json());
      }
    });
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

  const exportAsPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const title = room?.title || 'Untitled Story';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Create a temporary hidden container to render HTML
    const container = document.createElement('div');
    container.style.width = '170mm';
    container.style.padding = '0';
    container.style.margin = '0';
    container.style.fontSize = '12pt';
    container.style.fontFamily = 'serif';
    container.style.color = '#000';
    container.style.lineHeight = '1.5';
    container.style.whiteSpace = 'pre-wrap';
    container.style.wordBreak = 'break-word';

    const h1 = document.createElement('h1');
    h1.style.fontSize = '24pt';
    h1.style.textAlign = 'center';
    h1.style.marginBottom = '20pt';
    h1.innerText = title;
    container.appendChild(h1);

    const approved = contributions
      .filter(c => (c.status || 'approved') === 'approved')
      .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || new Date(a.created_at) - new Date(b.created_at));

    approved.forEach(c => {
      const section = document.createElement('div');
      section.style.marginBottom = '12pt';
      section.style.color = '#000';
      section.innerHTML = sanitizeRichHtml(c.content);
      container.appendChild(section);
    });

    document.body.appendChild(container);

    try {
      await doc.html(container, {
        x: 20,
        y: 20,
        width: 170,
        windowWidth: 800,
        autoPaging: 'text',
      });
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('PDF Export failed:', err);
    } finally {
      document.body.removeChild(container);
      setShowExportMenu(false);
    }
  };

  const exportAsWord = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
    const { saveAs } = await import('file-saver');

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
      // Basic HTML to docx conversion logic
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitizeRichHtml(c.content);

      const runs = [];
      const authorColor = (c.author_color || '#000000').replace('#', '');

      // Simple recursive walker for basic tags
      const traverse = (node) => {
        if (node.nodeType === 3) { // Text node
          runs.push(new TextRun({
            text: node.textContent,
            color: authorColor,
            bold: node.parentElement.tagName === 'B' || node.parentElement.tagName === 'STRONG',
            italics: node.parentElement.tagName === 'I' || node.parentElement.tagName === 'EM',
          }));
        } else {
          node.childNodes.forEach(traverse);
        }
      };

      traverse(tempDiv);

      children.push(
        new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: stripHTML(c.content), color: authorColor })],
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

    // EPUB uses server-side generation. Preserve HTML and add author colors.
    const bodyHtml = approved.map(c =>
      `<div style="color: ${c.author_color || '#000'}; margin-bottom: 1em;">${sanitizeRichHtml(c.content)}</div>`
    ).join('\n');
    const chapters = [{ title, content: bodyHtml || '<p> </p>' }];

    try {
      const { saveAs } = await import('file-saver');
      const res = await apiFetch(`/api/rooms/${roomId}/export/epub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, chapters }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`);
    } catch (err) {
      console.error('EPUB Export failed:', err);
      setPostError('EPUB export failed — please try again.');
      setTimeout(() => setPostError(''), 4000);
    }
    setShowExportMenu(false);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const fallbackCopy = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  };

  // ── Game challenge handlers ───────────────────────────────────────────
  const GAME_LABELS = { wordle: 'Wordle', hangman: 'Hangman', wordladder: 'Word Ladder' };

  const handleSendChallenge = (toUserId, toUserName, game, customWord = null) => {
    const seed = Math.floor(Math.random() * 100000);
    const challengeId = `${user?.id || 'anon'}_${Date.now()}`;
    socketRef.current?.emit('game:challenge', {
      toUserId, game, seed, challengeId,
      fromUser: { id: user?.id, name: user?.name },
      customWord,
    });
    setGameSession({
      game, seed, opponentId: toUserId, opponentName: toUserName,
      role: game === 'hangman' ? 'setter' : 'player',
      customWord,
    });
    setOpponentResult(null);
  };

  const acceptChallenge = () => {
    if (!incomingChallenge) return;
    const u = userRef.current;
    socketRef.current?.emit('game:challenge:respond', {
      challengeId: incomingChallenge.challengeId,
      accepted: true,
      fromUserId: incomingChallenge.fromUser.id,
      respondingUser: { id: u?.id, name: u?.name },
    });
    setGameSession({
      game: incomingChallenge.game,
      seed: incomingChallenge.seed,
      opponentName: incomingChallenge.fromUser.name,
      opponentId: incomingChallenge.fromUser.id,
      role: incomingChallenge.game === 'hangman' ? 'guesser' : 'player',
      customWord: incomingChallenge.customWord || null,
    });
    setOpponentResult(null);
    const g = incomingChallenge.game;
    setIncomingChallenge(null);
    if (g === 'wordle')     setShowWordle(true);
    if (g === 'hangman')    setShowHangman(true);
    if (g === 'wordladder') setShowWordLadder(true);
  };

  const declineChallenge = () => {
    if (!incomingChallenge) return;
    const u = userRef.current;
    socketRef.current?.emit('game:challenge:respond', {
      challengeId: incomingChallenge.challengeId,
      accepted: false,
      fromUserId: incomingChallenge.fromUser.id,
      respondingUser: { id: u?.id, name: u?.name },
    });
    setIncomingChallenge(null);
  };

  const handleVsResult = (result) => {
    if (gameSession?.opponentId) {
      socketRef.current?.emit('game:result', { toUserId: gameSession.opponentId, result });
    }
  };

  const clearGameSession = () => {
    setGameSession(null);
    setOpponentResult(null);
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    await apiFetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id })
    });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  if (!user) return <Navigate to="/auth" replace />;

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
      <RoomHeader
        room={room}
        user={user}
        navigate={navigate}
        view={view}
        setView={setView}
        handleCopyLink={handleCopyLink}
        linkCopied={linkCopied}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        handleExportTxt={handleExportTxt}
        handleExportPdf={exportAsPDF}
        handleExportDocx={exportAsWord}
        handleExportEpub={handleExportEpub}
        exportMenuRef={exportMenuRef}
        onlineUsers={onlineUsers}
        members={members}
        showWordle={showWordle}
        setShowWordle={setShowWordle}
        showHangman={showHangman}
        setShowHangman={setShowHangman}
        showWordLadder={showWordLadder}
        setShowWordLadder={setShowWordLadder}
        setShowContributors={setShowContributors}
        handleEntryLockToggle={handleEntryLockToggle}
        handleContribLockToggle={handleContribLockToggle}
        toggleTheme={toggleTheme}
        theme={theme}
        notifications={notifications}
        markAllNotificationsRead={markAllNotificationsRead}
      />

      {/* ── Body: contributions + chat sidebar ── */}
      <div className="room-body">
        {view === 'collab' && (
          <React.Suspense fallback={<div className="sidebar-loading-placeholder" />}>
            <ChatSidebar
              isOpen={chatOpen}
              onToggle={() => setChatOpen(!chatOpen)}
              currentUser={user}
              messages={chatMessages}
              onSend={handleSendChat}
            />
          </React.Suspense>
        )}

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
              activeCommentId={activeCommentId}
              onToggleComments={(id) => setActiveCommentId(prev => prev === id ? null : id)}
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

        {/* Comment Sidebar (Document-style) */}
        {view === 'collab' && (
          <SidebarComponent
            activeCommentId={activeCommentId}
            setActiveCommentId={setActiveCommentId}
            contributions={contributions}
            user={user}
            onAddComment={handleAddComment}
          />
        )}
      </div>

      {/* ── Input footer ── */}
      {view === 'collab' && (
        room?.is_locked ? (
          <footer className="room-footer locked-footer">
            <span><Lock size={14} /> This room is locked — no new contributions can be added.</span>
          </footer>
        ) : (
          <footer className="room-footer">
            <form className="contribution-form" onSubmit={handleSubmit}>
              {user && (
                <div className="form-nametag" style={{ '--user-color': user.color || '#6366f1' }}>
                  <span className="form-nametag-dot" />
                  <span className="form-nametag-name">{user.name}</span>
                </div>
              )}
              <RichEditor
                ref={editorRef}
                placeholder="Write something…"
                otherCursors={otherCursors}
                currentUserName={user?.name}
                showCommentBubble={false}
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
        <React.Suspense fallback={null}>
          <ContributorsPanel
            isOpen={showContributors}
            onClose={() => setShowContributors(false)}
            members={members}
            currentUser={user}
            isCreator={room?.creator_id === user?.id}
            roomId={roomId}
          />
        </React.Suspense>
      )}

      {/* Wordle game panel */}
      {showWordle && (
        <React.Suspense fallback={<div className="modal-loading-overlay"><div className="spinner" /></div>}>
          <WordleGame
            onClose={() => { setShowWordle(false); clearGameSession(); }}
            members={members}
            currentUser={user}
            onSendChallenge={(toId, toName) => handleSendChallenge(toId, toName, 'wordle')}
            vsSession={gameSession?.game === 'wordle' ? gameSession : null}
            opponentResult={gameSession?.game === 'wordle' ? opponentResult : null}
            onVsResult={handleVsResult}
          />
        </React.Suspense>
      )}

      {/* Hangman game panel */}
      {showHangman && (
        <React.Suspense fallback={<div className="modal-loading-overlay"><div className="spinner" /></div>}>
          <HangmanGame
            onClose={() => { setShowHangman(false); clearGameSession(); }}
            members={members}
            currentUser={user}
            onSendChallenge={(toId, toName, customWord) => handleSendChallenge(toId, toName, 'hangman', customWord)}
            vsSession={gameSession?.game === 'hangman' ? gameSession : null}
            opponentResult={gameSession?.game === 'hangman' ? opponentResult : null}
            onVsResult={handleVsResult}
          />
        </React.Suspense>
      )}

      {/* Word Ladder game panel */}
      {showWordLadder && (
        <React.Suspense fallback={<div className="modal-loading-overlay"><div className="spinner" /></div>}>
          <WordLadder
            onClose={() => { setShowWordLadder(false); clearGameSession(); }}
            members={members}
            currentUser={user}
            onSendChallenge={(toId, toName) => handleSendChallenge(toId, toName, 'wordladder')}
            vsSession={gameSession?.game === 'wordladder' ? gameSession : null}
            opponentResult={gameSession?.game === 'wordladder' ? opponentResult : null}
            onVsResult={handleVsResult}
          />
        </React.Suspense>
      )}

      {/* Incoming challenge toast */}
      {incomingChallenge && (
        <div className="challenge-toast">
          <span><Swords size={15} /> <strong>{incomingChallenge.fromUser?.name}</strong> challenges you to {GAME_LABELS[incomingChallenge.game] || incomingChallenge.game}!</span>
          <div className="challenge-toast-actions">
            <button className="btn-sm btn-primary" onClick={acceptChallenge}>Accept</button>
            <button className="btn-sm btn-secondary" onClick={declineChallenge}>Decline</button>
          </div>
        </div>
      )}

      {/* Challenge decline feedback */}
      {challengeMsg && !incomingChallenge && (
        <div className="challenge-toast challenge-toast--decline">{challengeMsg}</div>
      )}

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