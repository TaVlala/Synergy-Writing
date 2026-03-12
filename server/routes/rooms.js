const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createRoomsRouter({ store, save, io }) {
  const router = express.Router();

  router.post('/rooms', (req, res) => {
    const { title, creator_id } = req.body || {};
    if (!creator_id) return res.status(400).json({ error: 'creator_id required' });

    const room = {
      id: uuidv4().replace(/-/g, '').slice(0, 10),
      title: title?.trim() || null,
      creator_id,
      is_locked: 0,
      created_at: Date.now(),
    };
    store.rooms.push(room);
    save();
    res.json(room);
  });

  router.get('/rooms/:id', (req, res) => {
    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  });

  router.patch('/rooms/:id', (req, res) => {
    const { is_locked, is_entry_locked, user_id } = req.body || {};
    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only the room creator can do this' });

    if (is_locked !== undefined) room.is_locked = is_locked ? 1 : 0;
    if (is_entry_locked !== undefined) room.is_entry_locked = is_entry_locked ? 1 : 0;
    save();
    io.to(req.params.id).emit('room_updated', room);
    res.json(room);
  });

  router.post('/rooms/:id/join', (req, res) => {
    const { user_id } = req.body || {};
    const user_name = req.user.name;
    const user_color = req.user.color;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const existing = store.room_members.find(member => member.room_id === req.params.id && member.user_id === user_id);
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
      removed_by: null,
    };
    store.room_members.push(member);
    save();
    io.to(req.params.id).emit('member_joined', { user_id, user_name, user_color: member.user_color });
    return res.json(member);
  });

  router.get('/rooms/:id/members', (req, res) => {
    const members = store.room_members
      .filter(member => member.room_id === req.params.id)
      .map(member => ({
        ...member,
        contribution_count: store.contributions.filter(
          contribution => contribution.room_id === req.params.id && contribution.author_id === member.user_id
        ).length,
      }))
      .sort((a, b) => a.joined_at - b.joined_at);
    res.json(members);
  });

  router.delete('/rooms/:id/members/:userId', (req, res) => {
    const { user_id } = req.body || {};
    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only the room creator can remove members' });

    const member = store.room_members.find(entry => entry.room_id === req.params.id && entry.user_id === req.params.userId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.removed_at) return res.status(400).json({ error: 'Already removed' });

    member.removed_at = Date.now();
    member.removed_by = user_id;
    save();
    io.to(req.params.id).emit('member_removed', { user_id: req.params.userId });
    res.json(member);
  });

  router.get('/rooms/:id/chat', (req, res) => {
    const messages = store.chat_messages
      .filter(message => message.room_id === req.params.id)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(-100);
    res.json(messages);
  });

  router.post('/rooms/:id/chat', (req, res) => {
    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { author_id, content } = req.body || {};
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
      created_at: Date.now(),
    };
    store.chat_messages.push(message);
    save();
    io.to(req.params.id).emit('new_chat_message', message);
    res.json(message);
  });

  return router;
}

module.exports = {
  createRoomsRouter,
};
