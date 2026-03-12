const { v4: uuidv4 } = require('uuid');

function createNotificationHelper({ store, save, io }) {
  return function createNotification(userId, roomId, type, message) {
    if (!userId) return;
    const notification = {
      id: uuidv4(),
      user_id: userId,
      room_id: roomId,
      type,
      message,
      is_read: 0,
      created_at: Date.now(),
    };
    store.notifications.push(notification);
    save();
    io.to(`user_${userId}`).emit('notification', notification);
  };
}

module.exports = {
  createNotificationHelper,
};
