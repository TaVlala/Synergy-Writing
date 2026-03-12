import { useEffect, useRef, useState, startTransition } from 'react';
import { io } from 'socket.io-client';
import { APP_COLORS } from '../utils';

export function useRoomSocket({
  roomId,
  authToken,
  user,
  setRoom,
  setContributions,
  setChatMessages,
  setMembers,
  setNotifications,
  setMembershipStatus,
}) {
  const socketRef = useRef(null);
  const typingTimerRef = useRef({});
  const challengeTimeoutRef = useRef(null);
  const userRef = useRef(user);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [otherCursors, setOtherCursors] = useState({});
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [opponentResult, setOpponentResult] = useState(null);
  const [challengeMsg, setChallengeMsg] = useState('');

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!authToken) return undefined;

    const socket = io({
      auth: { token: authToken },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', roomId);
      const activeUser = userRef.current;
      if (activeUser) {
        socket.emit('join_user');
        socket.emit('user_online', {
          roomId,
          userId: activeUser.id,
          userName: activeUser.name,
          userColor: activeUser.color || APP_COLORS[5],
        });
      }
    });

    socket.on('new_contribution', contribution => {
      startTransition(() => {
        setContributions(prev => {
          if (prev.some(item => item.id === contribution.id)) return prev;
          return [...prev, contribution];
        });
      });
    });

    socket.on('contribution_deleted', ({ id }) => {
      setContributions(prev => prev.filter(item => item.id !== id));
    });

    socket.on('room_updated', updatedRoom => {
      setRoom(updatedRoom);
    });

    socket.on('reactions_updated', ({ contribution_id, reactions }) => {
      setContributions(prev => prev.map(item => (
        item.id === contribution_id ? { ...item, reactions } : item
      )));
    });

    socket.on('contribution_updated', updated => {
      setContributions(prev => prev.map(item => (
        item.id === updated.id ? { ...updated, comments: item.comments } : item
      )));
    });

    socket.on('contribution_status_changed', updated => {
      setContributions(prev => prev.map(item => (
        item.id === updated.id
          ? { ...item, status: updated.status, sort_order: updated.sort_order }
          : item
      )));
    });

    socket.on('contributions_reordered', updates => {
      const orderMap = Object.fromEntries(updates.map(update => [update.id, update.sort_order]));
      setContributions(prev => prev.map(item => (
        orderMap[item.id] !== undefined ? { ...item, sort_order: orderMap[item.id] } : item
      )));
    });

    socket.on('member_joined', member => {
      setMembers(prev => {
        if (prev.some(item => item.user_id === member.user_id)) return prev;
        return [...prev, { ...member, contribution_count: 0, joined_at: Date.now() }];
      });
    });

    socket.on('member_removed', ({ user_id: removedId }) => {
      setMembers(prev => prev.map(member => (
        member.user_id === removedId ? { ...member, removed_at: Date.now() } : member
      )));
      if (userRef.current?.id === removedId) {
        setMembershipStatus('removed');
      }
    });

    socket.on('new_comment', ({ contribution_id, comment }) => {
      setContributions(prev => prev.map(item => (
        item.id === contribution_id
          ? { ...item, comments: item.comments ? [...item.comments, comment] : [comment] }
          : item
      )));
    });

    socket.on('new_chat_message', message => {
      setChatMessages(prev => {
        if (prev.some(item => item.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on('notification', notif => {
      setNotifications(prev => [notif, ...prev]);
    });

    socket.on('user_typing', ({ userName }) => {
      setTypingUsers(prev => (prev.includes(userName) ? prev : [...prev, userName]));
      clearTimeout(typingTimerRef.current[userName]);
      typingTimerRef.current[userName] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(name => name !== userName));
      }, 3000);
    });

    socket.on('presence_update', users => {
      setOnlineUsers(users);
      setOtherCursors(prev => {
        const onlineIds = new Set(users.map(entry => entry.userId));
        return Object.fromEntries(
          Object.entries(prev).filter(([id]) => onlineIds.has(id))
        );
      });
    });

    socket.on('cursor_update', ({ userId, userName, userColor, position }) => {
      setOtherCursors(prev => ({
        ...prev,
        [userId]: { position, color: userColor, name: userName },
      }));
    });

    socket.on('game:challenge:received', challenge => {
      setIncomingChallenge(challenge);
    });

    socket.on('game:challenge:accepted', ({ game, seed, opponentName, opponentId, customWord }) => {
      setGameSession(prev => {
        if (prev && prev.game === game && prev.role === 'setter') {
          return { ...prev, opponentName, opponentId };
        }
        return { game, seed, opponentName, opponentId, role: game === 'hangman' ? 'setter' : 'player', customWord };
      });
      setOpponentResult(null);
    });

    socket.on('game:challenge:declined', ({ opponentName }) => {
      setGameSession(null);
      setChallengeMsg(`${opponentName} declined the challenge`);
      clearTimeout(challengeTimeoutRef.current);
      challengeTimeoutRef.current = setTimeout(() => setChallengeMsg(''), 3500);
    });

    socket.on('game:opponent:result', ({ result }) => {
      setOpponentResult(result);
    });

    return () => {
      Object.values(typingTimerRef.current).forEach(clearTimeout);
      clearTimeout(challengeTimeoutRef.current);
      socket.emit('leave_room', roomId);
      socket.disconnect();
    };
  }, [authToken, roomId, setChatMessages, setContributions, setMembers, setMembershipStatus, setNotifications, setRoom]);

  useEffect(() => {
    if (user && socketRef.current?.connected) {
      socketRef.current.emit('join_user');
      socketRef.current.emit('user_online', {
        roomId,
        userId: user.id,
        userName: user.name,
        userColor: user.color || APP_COLORS[5],
      });
    }
  }, [roomId, user]);

  const emitTyping = () => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('typing', { roomId, userName: user.name });
  };

  const emitCursorUpdate = position => {
    if (!user || !socketRef.current) return;
    socketRef.current.emit('cursor_update', {
      roomId,
      userId: user.id,
      userName: user.name,
      userColor: user.color || APP_COLORS[5],
      position,
    });
  };

  const sendChallenge = ({ toUserId, toUserName, game, customWord = null }) => {
    const activeUser = userRef.current;
    const seed = Math.floor(Math.random() * 100000);
    const challengeId = `${activeUser?.id || 'anon'}_${Date.now()}`;
    socketRef.current?.emit('game:challenge', {
      toUserId,
      game,
      seed,
      challengeId,
      customWord,
    });
    setGameSession({
      game,
      seed,
      opponentId: toUserId,
      opponentName: toUserName,
      role: game === 'hangman' ? 'setter' : 'player',
      customWord,
    });
    setOpponentResult(null);
  };

  const respondToChallenge = accepted => {
    if (!incomingChallenge) return null;
    const activeUser = userRef.current;
    socketRef.current?.emit('game:challenge:respond', {
      challengeId: incomingChallenge.challengeId,
      accepted,
      fromUserId: incomingChallenge.fromUser.id,
      respondingUser: { id: activeUser?.id, name: activeUser?.name },
    });

    if (!accepted) {
      setIncomingChallenge(null);
      return null;
    }

    const nextSession = {
      game: incomingChallenge.game,
      seed: incomingChallenge.seed,
      opponentName: incomingChallenge.fromUser.name,
      opponentId: incomingChallenge.fromUser.id,
      role: incomingChallenge.game === 'hangman' ? 'guesser' : 'player',
      customWord: incomingChallenge.customWord || null,
    };
    setGameSession(nextSession);
    setOpponentResult(null);
    setIncomingChallenge(null);
    return nextSession;
  };

  const emitVsResult = result => {
    if (gameSession?.opponentId) {
      socketRef.current?.emit('game:result', { toUserId: gameSession.opponentId, result });
    }
  };

  const clearGameSession = () => {
    setGameSession(null);
    setOpponentResult(null);
  };

  return {
    socketRef,
    typingUsers,
    onlineUsers,
    otherCursors,
    incomingChallenge,
    gameSession,
    opponentResult,
    challengeMsg,
    emitTyping,
    emitCursorUpdate,
    sendChallenge,
    acceptChallenge: () => respondToChallenge(true),
    declineChallenge: () => respondToChallenge(false),
    emitVsResult,
    clearGameSession,
  };
}
