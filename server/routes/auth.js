const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPublicUser } = require('../lib/auth');

function createAuthRouter({ store, save, signToken, authRequired }) {
  const router = express.Router();

  router.post('/auth/register', (req, res) => {
    const { username, password, name, color } = req.body || {};
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');
    const displayName = String(name || normalizedUsername).trim();

    if (!/^[a-z0-9_]{3,32}$/.test(normalizedUsername)) {
      return res.status(400).json({ error: 'username must be 3-32 chars (a-z, 0-9, _)' });
    }
    if (normalizedPassword.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    if (!displayName) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (store.users.some(user => user.username === normalizedUsername)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const user = {
      id: uuidv4(),
      username: normalizedUsername,
      name: displayName.slice(0, 50),
      color: color || '#6366f1',
      password_hash: bcrypt.hashSync(normalizedPassword, 10),
      created_at: Date.now(),
    };
    store.users.push(user);
    save();

    return res.json({ token: signToken(user.id), user: getPublicUser(user) });
  });

  router.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');
    const user = store.users.find(entry => entry.username === normalizedUsername);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!bcrypt.compareSync(normalizedPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ token: signToken(user.id), user: getPublicUser(user) });
  });

  router.get('/auth/me', authRequired, (req, res) => {
    res.json({ user: getPublicUser(req.user) });
  });

  router.patch('/users/me', authRequired, (req, res) => {
    const { name, color } = req.body || {};
    if (name !== undefined) {
      const trimmed = String(name || '').trim();
      if (!trimmed) return res.status(400).json({ error: 'Name is required' });
      req.user.name = trimmed.slice(0, 50);
    }
    if (color !== undefined) {
      req.user.color = String(color || '').trim() || req.user.color;
    }
    save();
    res.json(getPublicUser(req.user));
  });

  router.post('/users', (_req, res) => {
    res.status(410).json({ error: 'Use /api/auth/register or /api/auth/login' });
  });

  return router;
}

module.exports = {
  createAuthRouter,
};
