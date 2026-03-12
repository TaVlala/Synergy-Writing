const express = require('express');

function createNotificationsRouter({ store, save }) {
  const router = express.Router();

  router.get('/notifications', (req, res) => {
    const { user_id } = req.query || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const notifications = store.notifications
      .filter(notification => notification.user_id === user_id)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 50);
    res.json(notifications);
  });

  router.patch('/notifications/read-all', (req, res) => {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    store.notifications
      .filter(notification => notification.user_id === user_id)
      .forEach(notification => { notification.is_read = 1; });
    save();
    res.json({ success: true });
  });

  router.patch('/notifications/:id/read', (req, res) => {
    const notification = store.notifications.find(entry => entry.id === req.params.id);
    if (notification) {
      notification.is_read = 1;
      save();
    }
    res.json({ success: true });
  });

  return router;
}

module.exports = {
  createNotificationsRouter,
};
