const cors = require('cors');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { store, save } = require('./db');
const { createAuthHelpers } = require('./lib/auth');
const { CORS_ORIGINS, isProd, logConfigWarnings } = require('./lib/config');
const { createNotificationHelper } = require('./lib/notifications');
const { sanitizeRichHtml } = require('./lib/sanitize');
const { createAuthRouter } = require('./routes/auth');
const { createContributionsRouter } = require('./routes/contributions');
const { createExportRouter } = require('./routes/export');
const { createNotificationsRouter } = require('./routes/notifications');
const { createRoomsRouter } = require('./routes/rooms');
const { createSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

logConfigWarnings();

const { signToken, authRequired, socketAuth } = createAuthHelpers(store);
const createNotification = createNotificationHelper({ store, save, io });
const socketHandlers = createSocketHandlers(io);

io.use(socketAuth);
socketHandlers.attach();

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', createAuthRouter({ store, save, signToken, authRequired }));

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return authRequired(req, res, next);
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  const tokenUserId = req.user?.id;
  const body = req.body || {};
  const query = req.query || {};
  const candidateIds = [body.user_id, body.creator_id, body.author_id, query.user_id].filter(Boolean);
  if (candidateIds.some(id => id !== tokenUserId)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  return next();
});

app.use('/api', createRoomsRouter({ store, save, io }));
app.use('/api', createContributionsRouter({ store, save, io, sanitizeRichHtml, createNotification }));
app.use('/api', createNotificationsRouter({ store, save }));
app.use('/api', createExportRouter({ sanitizeRichHtml }));

if (isProd) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
