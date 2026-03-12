const express = require('express');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_EMOJIS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F604}', '\u{1F525}', '\u2728'];

function createContributionsRouter({ store, save, io, sanitizeRichHtml, createNotification }) {
  const router = express.Router();

  router.get('/rooms/:id/contributions', (req, res) => {
    const contributions = store.contributions
      .filter(contribution => contribution.room_id === req.params.id)
      .sort((a, b) => a.created_at - b.created_at)
      .map(contribution => ({
        ...contribution,
        content: sanitizeRichHtml(contribution.content),
        status: contribution.status || 'approved',
        sort_order: contribution.sort_order ?? contribution.created_at,
        reactions: store.reactions.filter(reaction => reaction.contribution_id === contribution.id),
      }));
    res.json(contributions);
  });

  router.post('/rooms/:id/contributions', (req, res) => {
    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.is_locked) return res.status(403).json({ error: 'This room is locked' });

    const { author_id, content, parent_id } = req.body || {};
    const author_name = req.user.name;
    const author_color = req.user.color;
    const sanitized = sanitizeRichHtml(content);
    const textContent = sanitized.replace(/<[^>]*>/g, '').trim();
    if (!textContent || !author_id || !author_name) {
      return res.status(400).json({ error: 'author_id, author_name, and content are required' });
    }

    const membership = store.room_members.find(member => member.room_id === req.params.id && member.user_id === author_id);
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
      reactions: [],
    };
    store.contributions.push(contribution);
    save();
    io.to(req.params.id).emit('new_contribution', contribution);

    if (parent_id) {
      const parent = store.contributions.find(entry => entry.id === parent_id);
      if (parent && parent.author_id !== author_id) {
        createNotification(parent.author_id, req.params.id, 'reply', `${author_name} replied to your contribution`);
      }
    } else {
      const seen = new Set();
      store.contributions
        .filter(entry => entry.room_id === req.params.id && entry.author_id !== author_id && entry.id !== contribution.id)
        .forEach(entry => {
          if (!seen.has(entry.author_id)) {
            seen.add(entry.author_id);
            createNotification(entry.author_id, req.params.id, 'new_contribution', `${author_name} added a new contribution`);
          }
        });
    }

    res.json(contribution);
  });

  router.patch('/contributions/:id', (req, res) => {
    const { user_id, content } = req.body || {};
    const sanitized = sanitizeRichHtml(content);
    if (!sanitized.trim()) return res.status(400).json({ error: 'Content is required' });

    const contribution = store.contributions.find(entry => entry.id === req.params.id);
    if (!contribution) return res.status(404).json({ error: 'Not found' });
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

  router.patch('/rooms/:roomId/contributions/:id/pin', (req, res) => {
    const { user_id, pinned } = req.body || {};
    const room = store.rooms.find(entry => entry.id === req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id) return res.status(403).json({ error: 'Only admin can pin contributions' });

    const contribution = store.contributions.find(entry => entry.id === req.params.id && entry.room_id === req.params.roomId);
    if (!contribution) return res.status(404).json({ error: 'Contribution not found' });

    store.contributions
      .filter(entry => entry.room_id === req.params.roomId && entry.pinned)
      .forEach(entry => {
        entry.pinned = false;
        io.to(entry.room_id).emit('contribution_updated', entry);
      });

    contribution.pinned = !!pinned;
    save();
    io.to(contribution.room_id).emit('contribution_updated', contribution);
    res.json(contribution);
  });

  router.delete('/contributions/:id', (req, res) => {
    const { user_id } = req.body || {};
    const index = store.contributions.findIndex(entry => entry.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Not found' });

    const contribution = store.contributions[index];
    const room = store.rooms.find(entry => entry.id === contribution.room_id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id && contribution.author_id !== user_id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    store.contributions.splice(index, 1);
    store.reactions = store.reactions.filter(reaction => reaction.contribution_id !== req.params.id);
    store.comments = store.comments.filter(comment => comment.contribution_id !== req.params.id);
    save();
    io.to(contribution.room_id).emit('contribution_deleted', { id: req.params.id });
    res.json({ success: true });
  });

  router.patch('/contributions/:id/status', (req, res) => {
    const { user_id, status } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }

    const contribution = store.contributions.find(entry => entry.id === req.params.id);
    if (!contribution) return res.status(404).json({ error: 'Not found' });
    const room = store.rooms.find(entry => entry.id === contribution.room_id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id) {
      return res.status(403).json({ error: 'Only the room creator can approve or reject contributions' });
    }

    contribution.status = status;
    if (status === 'approved') {
      const approved = store.contributions.filter(entry => (
        entry.room_id === contribution.room_id && entry.status === 'approved' && entry.sort_order != null
      ));
      const maxOrder = approved.length ? Math.max(...approved.map(entry => entry.sort_order)) : 0;
      contribution.sort_order = maxOrder + 10;
    }

    save();
    const updated = {
      ...contribution,
      reactions: store.reactions.filter(reaction => reaction.contribution_id === contribution.id),
    };
    io.to(contribution.room_id).emit('contribution_status_changed', updated);
    res.json(updated);
  });

  router.patch('/rooms/:id/reorder', (req, res) => {
    const { user_id, order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });

    const room = store.rooms.find(entry => entry.id === req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.creator_id !== user_id) {
      return res.status(403).json({ error: 'Only the room creator can reorder contributions' });
    }

    const updates = [];
    order.forEach((id, index) => {
      const contribution = store.contributions.find(entry => entry.id === id && entry.room_id === req.params.id);
      if (!contribution) return;
      contribution.sort_order = (index + 1) * 10;
      updates.push({ id, sort_order: contribution.sort_order });
    });

    save();
    io.to(req.params.id).emit('contributions_reordered', updates);
    res.json({ success: true, updates });
  });

  router.get('/contributions/:id/comments', (req, res) => {
    const comments = store.comments
      .filter(comment => comment.contribution_id === req.params.id)
      .sort((a, b) => a.created_at - b.created_at);
    res.json(comments);
  });

  router.post('/contributions/:id/comments', (req, res) => {
    const { author_id, content, parent_id, inline_id } = req.body || {};
    const author_name = req.user.name;
    if (!content?.trim() || !author_id || !author_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const contribution = store.contributions.find(entry => entry.id === req.params.id);
    if (!contribution) return res.status(404).json({ error: 'Contribution not found' });

    const comment = {
      id: uuidv4(),
      contribution_id: req.params.id,
      author_id,
      author_name,
      content: content.trim(),
      parent_id: parent_id || null,
      inline_id: inline_id || null,
      created_at: Date.now(),
    };
    store.comments.push(comment);
    save();
    io.to(contribution.room_id).emit('new_comment', { contribution_id: req.params.id, comment });

    if (contribution.author_id !== author_id) {
      createNotification(contribution.author_id, contribution.room_id, 'comment', `${author_name} commented on your contribution`);
    }
    if (parent_id) {
      const parentComment = store.comments.find(entry => entry.id === parent_id);
      if (parentComment && parentComment.author_id !== author_id && parentComment.author_id !== contribution.author_id) {
        createNotification(parentComment.author_id, contribution.room_id, 'reply', `${author_name} replied to your comment`);
      }
    }

    res.json(comment);
  });

  router.post('/contributions/:id/reactions', (req, res) => {
    const { user_id, emoji } = req.body || {};
    if (!user_id || !emoji) return res.status(400).json({ error: 'Missing fields' });
    if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' });

    const contribution = store.contributions.find(entry => entry.id === req.params.id);
    if (!contribution) return res.status(404).json({ error: 'Not found' });

    const existingIndex = store.reactions.findIndex(reaction => (
      reaction.contribution_id === req.params.id && reaction.user_id === user_id && reaction.emoji === emoji
    ));

    if (existingIndex !== -1) {
      store.reactions.splice(existingIndex, 1);
    } else {
      store.reactions.push({ id: uuidv4(), contribution_id: req.params.id, user_id, emoji, created_at: Date.now() });
    }
    save();

    const reactions = store.reactions.filter(reaction => reaction.contribution_id === req.params.id);
    io.to(contribution.room_id).emit('reactions_updated', { contribution_id: req.params.id, reactions });
    res.json(reactions);
  });

  return router;
}

module.exports = {
  createContributionsRouter,
};
