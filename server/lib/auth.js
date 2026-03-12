const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

function getPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    color: user.color,
    created_at: user.created_at,
  };
}

function createAuthHelpers(store) {
  function signToken(userId) {
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
  }

  function resolveUser(token) {
    const payload = jwt.verify(token, JWT_SECRET);
    return store.users.find(user => user.id === payload.sub) || null;
  }

  function authRequired(req, res, next) {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = resolveUser(match[1]);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  function socketAuth(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const user = resolveUser(token);
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  }

  return {
    signToken,
    authRequired,
    socketAuth,
  };
}

module.exports = {
  getPublicUser,
  createAuthHelpers,
};
