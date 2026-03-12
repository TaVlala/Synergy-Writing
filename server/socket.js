function createSocketHandlers(io) {
  const presence = {};
  const pendingChallenges = {};
  const activeGameChallenges = {};

  function getOnlineUsers(roomId) {
    return Object.values(presence)
      .filter(entry => entry.roomId === roomId)
      .map(({ userId, userName, userColor }) => ({ userId, userName, userColor }));
  }

  function attach() {
    io.on('connection', socket => {
      console.log('User connected:', socket.id, 'from', socket.handshake.headers.origin);

      socket.on('join_room', roomId => socket.join(roomId));
      socket.on('join_user', () => {
        const userId = socket.user.id;
        socket.join(`user_${userId}`);
        if (pendingChallenges[userId]?.length) {
          pendingChallenges[userId].forEach(challenge => socket.emit('game:challenge:received', challenge));
          delete pendingChallenges[userId];
        }
      });

      socket.on('user_online', ({ roomId }) => {
        const { id: userId, name: userName, color: userColor } = socket.user;
        presence[socket.id] = { userId, roomId, userName, userColor };
        io.to(roomId).emit('presence_update', getOnlineUsers(roomId));
      });

      socket.on('leave_room', roomId => {
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

      socket.on('game:challenge', ({ toUserId, game, seed, challengeId, customWord }) => {
        const fromUser = { id: socket.user.id, name: socket.user.name, color: socket.user.color };
        const challenge = { challengeId, game, seed, fromUser, customWord };
        activeGameChallenges[challengeId] = challenge;
        const isOnline = Object.values(presence).some(entry => entry.userId === toUserId);
        if (isOnline) {
          io.to(`user_${toUserId}`).emit('game:challenge:received', challenge);
        } else {
          pendingChallenges[toUserId] = pendingChallenges[toUserId] || [];
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
  }

  return {
    attach,
  };
}

module.exports = {
  createSocketHandlers,
};
