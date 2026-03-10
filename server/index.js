const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { store, save } = require('./db');

const app = express();
const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (isProd && !process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET is not set in production; tokens are insecure.');
}

const DEV_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://0.0.0.0:5173',
  'http://0.0.0.0:5174'
];

// In production, set CORS_ORIGINS to a comma-separated list of allowed frontend origins.
// If unset, we default to allow-all to preserve existing behavior.
const PROD_CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const CORS_ORIGINS = isProd
  ? (PROD_CORS_ORIGINS.length ? PROD_CORS_ORIGINS : true)
  : DEV_CORS_ORIGINS;

const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('unauthorized'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = store.users.find(u => u.id === payload.sub);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'from', socket.handshake.headers.origin);
});

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let sanitizeHtml = null;
try {
  sanitizeHtml = require('sanitize-html');
} catch {
  sanitizeHtml = null;
}

function sanitizeRichHtml(input) {
  if (typeof input !== 'string') return '';
  const raw = input.trim();
  if (!raw) return '';
  if (!sanitizeHtml) {
    // Safe fallback: strip all tags (loses formatting but avoids XSS).
    return raw.replace(/<[^>]*>/g, '');
  }

  return sanitizeHtml(raw, {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'blockquote',
      'ul', 'ol', 'li',
      'a', 'img',
      'code', 'pre'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      '*': ['style', 'class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    },
    allowedStyles: {
      '*': {
        color: [/^#([0-9a-f]{3}){1,2}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*(0|1|0?\.\d+))?\s*\)$/],
        'background-color': [/^#([0-9a-f]{3}){1,2}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(,\s*(0|1|0?\.\d+))?\s*\)$/],
        'text-align': [/^(left|right|center|justify)$/],
        'text-decoration': [/^(none|underline|line-through)$/],
      },
    },
  });
}

// ============ HELPERS ============

function createNotification(userId, roomId, type, message) {
  if (!userId) return;
  const notif = {
    id: uuidv4(),
    user_id: userId,
    room_id: roomId,
    type,
    message,
    is_read: 0,
    created_at: Date.now()
  };
  store.notifications.push(notif);
  save();
  io.to(`user_${userId}`).emit('notification', notif);
}

// ============ AUTH ============

function getPublicUser(u) {
  return { id: u.id, username: u.username, name: u.name, color: u.color, created_at: u.created_at };
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    const user = store.users.find(u => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// All /api routes require auth except /api/auth/*
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return authRequired(req, res, next);
});

// Prevent trivial ID spoofing: if a body/query includes a user id, it must match the token.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  const tokenUserId = req.user?.id;
  const body = req.body || {};
  const query = req.query || {};
  const candidateIds = [body.user_id, body.creator_id, body.author_id, query.user_id].filter(Boolean);
  if (candidateIds.some(id => id !== tokenUserId)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, name, color } = req.body || {};
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  const displayName = String(name || u).trim();
  if (!/^[a-z0-9_]{3,32}$/.test(u)) {
    return res.status(400).json({ error: 'username must be 3-32 chars (a-z, 0-9, _)' });
  }
  if (p.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  if (!displayName) return res.status(400).json({ error: 'name is required' });
  if (store.users.some(x => x.username === u)) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const password_hash = bcrypt.hashSync(p, 10);
  const user = {
    id: uuidv4(),
    username: u,
    name: displayName.slice(0, 50),
    color: (color || '#6366f1'),
    password_hash,
    created_at: Date.now()
  };
  store.users.push(user);
  save();
  const token = signToken(user.id);
  res.json({ token, user: getPublicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  const user = store.users.find(x => x.username === u);
  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(p, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user.id);
  res.json({ token, user: getPublicUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: getPublicUser(req.user) });
});

app.patch('/api/users/me', (req, res) => {
  const { name, color } = req.body || {};
  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Name is required' });
    req.user.name = trimmed.slice(0, 50);
  }
  if (color !== undefined) req.user.color = String(color || '').trim() || req.user.color;
  save();
  res.json(getPublicUser(req.user));
});

// ============ USERS ============

app.post('/api/users', (_req, res) => {
  res.status(410).json({ error: 'Use /api/auth/register or /api/auth/login' });
});

// ============ ROOMS ============

app.post('/api/rooms', (req, res) => {
  const { title, creator_id } = req.body;
  if (!creator_id) return res.status(400).json({ error: 'creator_id required' });

  const room = {
    id: uuidv4().replace(/-/g, '').slice(0, 10),
    title: title?.trim() || null,
    creator_id,
    is_locked: 0,
    created_at: Date.now()
  };
  store.rooms.push(room);
  save();
  res.json(room);
});

app.get('/api/rooms/:id', (req, res) => {
  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

app.patch('/api/rooms/:id', (req, res) => {
  const { is_locked, is_entry_locked, user_id } = req.body;
  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only the room creator can do this' });

  if (is_locked !== undefined) room.is_locked = is_locked ? 1 : 0;
  if (is_entry_locked !== undefined) room.is_entry_locked = is_entry_locked ? 1 : 0;
  save();
  io.to(req.params.id).emit('room_updated', room);
  res.json(room);
});

// ============ ROOM MEMBERS ============

// Join a room — register/update membership, enforce entry lock
app.post('/api/rooms/:id/join', (req, res) => {
  const { user_id } = req.body;
  const user_name = req.user.name;
  const user_color = req.user.color;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const existing = store.room_members.find(m => m.room_id === req.params.id && m.user_id === user_id);

  if (existing?.removed_at) {
    return res.status(403).json({ error: 'You have been removed from this room', reason: 'removed' });
  }

  if (room.is_entry_locked && !existing) {
    return res.status(403).json({ error: 'This room is closed to new members', reason: 'entry_locked' });
  }

  if (existing) {
    existing.user_name = user_name;
    if (user_color) existing.user_color = user_color;
    existing.last_seen = Date.now();
    save();
    return res.json(existing);
  }

  const member = {
    id: uuidv4(),
    room_id: req.params.id,
    user_id,
    user_name,
    user_color: user_color || '#6366f1',
    joined_at: Date.now(),
    last_seen: Date.now(),
    removed_at: null,
    removed_by: null
  };
  store.room_members.push(member);
  save();

  io.to(req.params.id).emit('member_joined', { user_id, user_name, user_color: member.user_color });
  res.json(member);
});

// List all members of a room (with contribution counts)
app.get('/api/rooms/:id/members', (req, res) => {
  const members = store.room_members
    .filter(m => m.room_id === req.params.id)
    .map(m => ({
      ...m,
      contribution_count: store.contributions.filter(
        c => c.room_id === req.params.id && c.author_id === m.user_id
      ).length
    }))
    .sort((a, b) => a.joined_at - b.joined_at);
  res.json(members);
});

// Remove (kick) a member — admin only
app.delete('/api/rooms/:id/members/:userId', (req, res) => {
  const { user_id } = req.body;
  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only the room creator can remove members' });

  const member = store.room_members.find(m => m.room_id === req.params.id && m.user_id === req.params.userId);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (member.removed_at) return res.status(400).json({ error: 'Already removed' });

  member.removed_at = Date.now();
  member.removed_by = user_id;
  save();

  io.to(req.params.id).emit('member_removed', { user_id: req.params.userId });
  res.json(member);
});

// ============ CONTRIBUTIONS ============

app.get('/api/rooms/:id/contributions', (req, res) => {
  const contribs = store.contributions
    .filter(c => c.room_id === req.params.id)
    .sort((a, b) => a.created_at - b.created_at)
    .map(c => ({
      ...c,
      content: sanitizeRichHtml(c.content),
      // Backwards-compat: old contributions without status are treated as approved
      status: c.status || 'approved',
      sort_order: c.sort_order ?? c.created_at,
      reactions: store.reactions.filter(r => r.contribution_id === c.id)
    }));
  res.json(contribs);
});

app.post('/api/rooms/:id/contributions', (req, res) => {
  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.is_locked) return res.status(403).json({ error: 'This room is locked' });

  const { author_id, content, parent_id } = req.body;
  const author_name = req.user.name;
  const author_color = req.user.color;
  const sanitized = sanitizeRichHtml(content);
  const textContent = sanitized.replace(/<[^>]*>/g, '').trim();
  if (!textContent || !author_id || !author_name) {
    return res.status(400).json({ error: 'author_id, author_name, and content are required' });
  }

  // Check if author has been removed from this room
  const membership = store.room_members.find(m => m.room_id === req.params.id && m.user_id === author_id);
  if (membership?.removed_at) {
    return res.status(403).json({ error: 'You have been removed from this room' });
  }

  const contribution = {
    id: uuidv4(),
    room_id: req.params.id,
    author_id,
    author_name,
    author_color: author_color || '#6366f1',
    content: content.trim(),
    parent_id: parent_id || null,
    status: 'pending',
    sort_order: null,
    created_at: Date.now(),
    reactions: []
  };
  store.contributions.push(contribution);
  save();

  io.to(req.params.id).emit('new_contribution', contribution);

  // Notifications
  if (parent_id) {
    const parent = store.contributions.find(c => c.id === parent_id);
    if (parent && parent.author_id !== author_id) {
      createNotification(parent.author_id, req.params.id, 'reply', `${author_name} replied to your contribution`);
    }
  } else {
    const seen = new Set();
    store.contributions
      .filter(c => c.room_id === req.params.id && c.author_id !== author_id && c.id !== contribution.id)
      .forEach(c => {
        if (!seen.has(c.author_id)) {
          seen.add(c.author_id);
          createNotification(c.author_id, req.params.id, 'new_contribution', `${author_name} added a new contribution`);
        }
      });
  }

  res.json(contribution);
});

app.patch('/api/contributions/:id', (req, res) => {
  const { user_id, content } = req.body;
  const sanitized = sanitizeRichHtml(content);
  if (!sanitized.trim()) return res.status(400).json({ error: 'Content is required' });

  const idx = store.contributions.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const contribution = store.contributions[idx];
  if (contribution.author_id !== user_id) {
    return res.status(403).json({ error: 'Only the author can edit this' });
  }

  const wasApproved = contribution.status === 'approved';

  contribution.content = sanitized;
  contribution.edited_at = Date.now();
  if (wasApproved) {
    contribution.status = 'pending';
    contribution.sort_order = null;
  }
  save();

  io.to(contribution.room_id).emit('contribution_updated', contribution);
  res.json(contribution);
});

// Pin / unpin a contribution (admin only, one pin per room)
app.patch('/api/rooms/:roomId/contributions/:id/pin', (req, res) => {
  const { user_id, pinned } = req.body;

  const room = store.rooms.find(r => r.id === req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only admin can pin contributions' });

  const contribution = store.contributions.find(c => c.id === req.params.id && c.room_id === req.params.roomId);
  if (!contribution) return res.status(404).json({ error: 'Contribution not found' });

  // Unpin any currently pinned contribution in this room
  store.contributions
    .filter(c => c.room_id === req.params.roomId && c.pinned)
    .forEach(c => {
      c.pinned = false;
      io.to(c.room_id).emit('contribution_updated', c);
    });

  // Pin (or just unpin if toggling off)
  contribution.pinned = !!pinned;
  save();

  io.to(contribution.room_id).emit('contribution_updated', contribution);
  res.json(contribution);
});

app.delete('/api/contributions/:id', (req, res) => {
  const { user_id } = req.body;
  const idx = store.contributions.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const contribution = store.contributions[idx];
  const room = store.rooms.find(r => r.id === contribution.room_id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.creator_id !== user_id && contribution.author_id !== user_id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  store.contributions.splice(idx, 1);
  store.reactions = store.reactions.filter(r => r.contribution_id !== req.params.id);
  store.comments = store.comments.filter(c => c.contribution_id !== req.params.id);
  save();

  io.to(contribution.room_id).emit('contribution_deleted', { id: req.params.id });
  res.json({ success: true });
});

// Approve or reject a contribution (room creator only)
app.patch('/api/contributions/:id/status', (req, res) => {
  const { user_id, status } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }

  const idx = store.contributions.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const contribution = store.contributions[idx];
  const room = store.rooms.find(r => r.id === contribution.room_id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.creator_id !== user_id) {
    return res.status(403).json({ error: 'Only the room creator can approve or reject contributions' });
  }

  contribution.status = status;

  if (status === 'approved') {
    // Assign sort_order = max existing approved sort_order + 10
    const approved = store.contributions.filter(c =>
      c.room_id === contribution.room_id && c.status === 'approved' && c.sort_order != null
    );
    const maxOrder = approved.length > 0 ? Math.max(...approved.map(c => c.sort_order)) : 0;
    contribution.sort_order = maxOrder + 10;
  }

  save();

  const updated = {
    ...contribution,
    reactions: store.reactions.filter(r => r.contribution_id === contribution.id)
  };

  io.to(contribution.room_id).emit('contribution_status_changed', updated);
  res.json(updated);
});

// Reorder approved contributions (room creator only)
app.patch('/api/rooms/:id/reorder', (req, res) => {
  const { user_id, order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });

  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.creator_id !== user_id) {
    return res.status(403).json({ error: 'Only the room creator can reorder contributions' });
  }

  const updates = [];
  order.forEach((id, idx) => {
    const c = store.contributions.find(c => c.id === id && c.room_id === req.params.id);
    if (c) {
      c.sort_order = (idx + 1) * 10;
      updates.push({ id, sort_order: c.sort_order });
    }
  });

  save();
  io.to(req.params.id).emit('contributions_reordered', updates);
  res.json({ success: true, updates });
});

// ============ COMMENTS ============

app.get('/api/contributions/:id/comments', (req, res) => {
  const comments = store.comments
    .filter(c => c.contribution_id === req.params.id)
    .sort((a, b) => a.created_at - b.created_at);
  res.json(comments);
});

app.post('/api/contributions/:id/comments', (req, res) => {
  const { author_id, content, parent_id, inline_id } = req.body;
  const author_name = req.user.name;
  if (!content?.trim() || !author_id || !author_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const contribution = store.contributions.find(c => c.id === req.params.id);
  if (!contribution) return res.status(404).json({ error: 'Contribution not found' });

  const comment = {
    id: uuidv4(),
    contribution_id: req.params.id,
    author_id,
    author_name,
    content: content.trim(),
    parent_id: parent_id || null,
    inline_id: inline_id || null,
    created_at: Date.now()
  };
  store.comments.push(comment);
  save();

  io.to(contribution.room_id).emit('new_comment', { contribution_id: req.params.id, comment });

  if (contribution.author_id !== author_id) {
    createNotification(contribution.author_id, contribution.room_id, 'comment', `${author_name} commented on your contribution`);
  }
  if (parent_id) {
    const parentComment = store.comments.find(c => c.id === parent_id);
    if (parentComment && parentComment.author_id !== author_id && parentComment.author_id !== contribution.author_id) {
      createNotification(parentComment.author_id, contribution.room_id, 'reply', `${author_name} replied to your comment`);
    }
  }

  res.json(comment);
});

// ============ REACTIONS ============

const ALLOWED_EMOJIS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F604}', '\u{1F525}', '\u2728'];

app.post('/api/contributions/:id/reactions', (req, res) => {
  const { user_id, emoji } = req.body;
  if (!user_id || !emoji) return res.status(400).json({ error: 'Missing fields' });
  if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' });

  const contribution = store.contributions.find(c => c.id === req.params.id);
  if (!contribution) return res.status(404).json({ error: 'Not found' });

  const existingIdx = store.reactions.findIndex(
    r => r.contribution_id === req.params.id && r.user_id === user_id && r.emoji === emoji
  );

  if (existingIdx !== -1) {
    store.reactions.splice(existingIdx, 1);
  } else {
    store.reactions.push({ id: uuidv4(), contribution_id: req.params.id, user_id, emoji, created_at: Date.now() });
  }
  save();

  const reactions = store.reactions.filter(r => r.contribution_id === req.params.id);
  io.to(contribution.room_id).emit('reactions_updated', { contribution_id: req.params.id, reactions });
  res.json(reactions);
});

// ============ CHAT ============

app.get('/api/rooms/:id/chat', (req, res) => {
  const messages = store.chat_messages
    .filter(m => m.room_id === req.params.id)
    .sort((a, b) => a.created_at - b.created_at)
    .slice(-100);
  res.json(messages);
});

app.post('/api/rooms/:id/chat', (req, res) => {
  const room = store.rooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const { author_id, content } = req.body;
  const author_name = req.user.name;
  const author_color = req.user.color;
  if (!content?.trim() || !author_id) {
    return res.status(400).json({ error: 'author_id and content are required' });
  }

  const message = {
    id: uuidv4(),
    room_id: req.params.id,
    author_id,
    author_name,
    author_color: author_color || '#6366f1',
    content: content.trim(),
    created_at: Date.now()
  };
  store.chat_messages.push(message);
  save();

  io.to(req.params.id).emit('new_chat_message', message);
  res.json(message);
});

// ============ NOTIFICATIONS ============

app.get('/api/notifications', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  const notifs = store.notifications
    .filter(n => n.user_id === user_id)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, 50);
  res.json(notifs);
});

// Must come before /:id to avoid route conflict
app.patch('/api/notifications/read-all', (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  store.notifications.filter(n => n.user_id === user_id).forEach(n => { n.is_read = 1; });
  save();
  res.json({ success: true });
});

app.patch('/api/notifications/:id/read', (req, res) => {
  const notif = store.notifications.find(n => n.id === req.params.id);
  if (notif) { notif.is_read = 1; save(); }
  res.json({ success: true });
});

// ============ SOCKET.IO ============

// Presence map: socketId → { userId, roomId, userName, userColor }
const presence = {};

// Game challenge state (in-memory)
const pendingChallenges = {};   // toUserId → [challenge, ...]
const activeGameChallenges = {}; // challengeId → challenge data

function getOnlineUsers(roomId) {
  return Object.values(presence)
    .filter(p => p.roomId === roomId)
    .map(({ userId, userName, userColor }) => ({ userId, userName, userColor }));
}

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => socket.join(roomId));
  socket.on('join_user', () => {
    const userId = socket.user.id;
    socket.join(`user_${userId}`);
    // Deliver any pending game challenges for this user
    if (pendingChallenges[userId]?.length) {
      pendingChallenges[userId].forEach(ch => socket.emit('game:challenge:received', ch));
      delete pendingChallenges[userId];
    }
  });

  socket.on('user_online', ({ roomId }) => {
    const { id: userId, name: userName, color: userColor } = socket.user;
    presence[socket.id] = { userId, roomId, userName, userColor };
    io.to(roomId).emit('presence_update', getOnlineUsers(roomId));
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    if (presence[socket.id]?.roomId === roomId) {
      delete presence[socket.id];
      io.to(roomId).emit('presence_update', getOnlineUsers(roomId));
    }
  });

  socket.on('typing', ({ roomId }) => {
    socket.to(roomId).emit('user_typing', { userName: socket.user.name });
  });

  socket.on('cursor_update', ({ roomId, position }) => {
    socket.to(roomId).emit('cursor_update', {
      userId: socket.user.id,
      userName: socket.user.name,
      userColor: socket.user.color,
      position,
    });
  });

  socket.on('disconnect', () => {
    const info = presence[socket.id];
    if (info) {
      delete presence[socket.id];
      io.to(info.roomId).emit('presence_update', getOnlineUsers(info.roomId));
    }
  });

  // ── Game challenge events ──────────────────────────────────────────────
  socket.on('game:challenge', ({ toUserId, game, seed, challengeId, customWord }) => {
    const fromUser = { id: socket.user.id, name: socket.user.name, color: socket.user.color };
    const challenge = { challengeId, game, seed, fromUser, customWord };
    activeGameChallenges[challengeId] = challenge;
    const isOnline = Object.values(presence).some(p => p.userId === toUserId);
    if (isOnline) {
      io.to(`user_${toUserId}`).emit('game:challenge:received', challenge);
    } else {
      if (!pendingChallenges[toUserId]) pendingChallenges[toUserId] = [];
      pendingChallenges[toUserId].push(challenge);
    }
  });

  socket.on('game:challenge:respond', ({ challengeId, accepted, fromUserId }) => {
    const respondingUser = { id: socket.user.id, name: socket.user.name, color: socket.user.color };
    const challenge = activeGameChallenges[challengeId];
    delete activeGameChallenges[challengeId];
    if (accepted) {
      io.to(`user_${fromUserId}`).emit('game:challenge:accepted', {
        game: challenge?.game,
        seed: challenge?.seed,
        opponentName: respondingUser.name,
        opponentId: respondingUser.id,
        customWord: challenge?.customWord,
      });
    } else {
      io.to(`user_${fromUserId}`).emit('game:challenge:declined', {
        opponentName: respondingUser.name,
      });
    }
  });

  socket.on('game:result', ({ toUserId, result }) => {
    io.to(`user_${toUserId}`).emit('game:opponent:result', { result });
  });
});

// ============ EPUB EXPORT ============

app.post('/api/rooms/:id/export/epub', async (req, res) => {
  const { title, chapters } = req.body;
  if (!title || !Array.isArray(chapters) || chapters.length === 0) {
    return res.status(400).json({ error: 'title and chapters required' });
  }
  try {
    // epub-gen-memory requires the File global (Node 20+); polyfill for older runtimes
    if (typeof globalThis.File === 'undefined') {
      const { Blob } = require('buffer');
      globalThis.File = class File extends Blob {
        constructor(chunks, name, opts = {}) {
          super(chunks, opts);
          this.name = name;
          this.lastModified = opts.lastModified || Date.now();
        }
      };
    }
    const epubGen = require('epub-gen-memory');
    const fn = epubGen.default || epubGen;
    const safeChapters = chapters.map(ch => ({ ...ch, content: sanitizeRichHtml(ch.content) }));
    const buffer = await fn({ title, author: 'Penwove Contributors', publisher: 'Penwove' }, safeChapters);
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.epub"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('EPUB generation failed:', err);
    res.status(500).json({ error: 'EPUB generation failed', detail: err.message });
  }
});

// ============ STATIC (production) ============

if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ============ START ============

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✍️  Collab Write server → http://localhost:${PORT}\n`);
});
