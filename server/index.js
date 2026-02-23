const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { store, save } = require('./db');

const app = express();
const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
const CORS_ORIGINS = isProd ? true : ['http://localhost:5173', 'http://localhost:4173'];

const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

// ============ HELPERS ============

const now = () => Date.now();

function createNotification(userId, roomId, type, message) {
  const notif = { id: uuidv4(), user_id: userId, room_id: roomId, type, message, is_read: 0, created_at: now() };
  store.notifications.push(notif);
  save();
  io.to(`user_${userId}`).emit('notification', notif);
}

// ============ USERS ============

app.post('/api/users', (req, res) => {
  const { name, id, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const trimmedName = name.trim();

  if (id) {
    const idx = store.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      store.users[idx].name = trimmedName;
      if (color) store.users[idx].color = color;
      save();
      return res.json(store.users[idx]);
    }
  }

  const user = { id: id || uuidv4(), name: trimmedName, color: color || '#6366f1', created_at: now() };
  store.users.push(user);
  save();
  res.json(user);
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
    created_at: now()
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
  const { user_id, user_name, user_color } = req.body;
  if (!user_id || !user_name) return res.status(400).json({ error: 'user_id and user_name required' });

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
    existing.last_seen = now();
    save();
    return res.json(existing);
  }

  const member = {
    id: uuidv4(),
    room_id: req.params.id,
    user_id,
    user_name,
    user_color: user_color || '#6366f1',
    joined_at: now(),
    last_seen: now(),
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

  member.removed_at = now();
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

  const { author_id, author_name, author_color, content, parent_id } = req.body;
  if (!content?.trim() || !author_id || !author_name) {
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
    created_at: now(),
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
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

  const idx = store.contributions.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const contribution = store.contributions[idx];
  if (contribution.author_id !== user_id) {
    return res.status(403).json({ error: 'Only the author can edit this' });
  }

  const wasApproved = contribution.status === 'approved';

  contribution.content = content.trim();
  contribution.edited_at = now();
  if (wasApproved) {
    contribution.status = 'pending';
    contribution.sort_order = null;
  }
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
  const { author_id, author_name, content, parent_id } = req.body;
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
    created_at: now()
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

const ALLOWED_EMOJIS = ['👍', '❤️', '😄', '🔥', '✨'];

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
    store.reactions.push({ id: uuidv4(), contribution_id: req.params.id, user_id, emoji, created_at: now() });
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

  const { author_id, author_name, author_color, content } = req.body;
  if (!content?.trim() || !author_id || !author_name) {
    return res.status(400).json({ error: 'author_id, author_name, and content are required' });
  }

  const message = {
    id: uuidv4(),
    room_id: req.params.id,
    author_id,
    author_name,
    author_color: author_color || '#6366f1',
    content: content.trim(),
    created_at: now()
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

function getOnlineUsers(roomId) {
  return Object.values(presence)
    .filter(p => p.roomId === roomId)
    .map(({ userId, userName, userColor }) => ({ userId, userName, userColor }));
}

io.on('connection', (socket) => {
  socket.on('join_room', (roomId) => socket.join(roomId));
  socket.on('join_user', (userId) => socket.join(`user_${userId}`));

  socket.on('user_online', ({ roomId, userId, userName, userColor }) => {
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

  socket.on('typing', ({ roomId, userName }) => {
    socket.to(roomId).emit('user_typing', { userName });
  });

  socket.on('disconnect', () => {
    const info = presence[socket.id];
    if (info) {
      delete presence[socket.id];
      io.to(info.roomId).emit('presence_update', getOnlineUsers(info.roomId));
    }
  });
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
