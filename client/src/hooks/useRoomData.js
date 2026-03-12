import { useEffect, useState, startTransition } from 'react';
import { parseJsonResponse, requestJson } from '../lib/api';

export function useRoomData({ roomId, user, apiFetch }) {
  const [room, setRoom] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [membershipStatus, setMembershipStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      setLoading(true);
      setError('');
      try {
        const [roomData, contribData, chatData] = await Promise.all([
          requestJson(apiFetch, `/api/rooms/${roomId}`),
          requestJson(apiFetch, `/api/rooms/${roomId}/contributions`),
          requestJson(apiFetch, `/api/rooms/${roomId}/chat`),
        ]);

        if (cancelled) return;
        startTransition(() => {
          setRoom(roomData);
          setContributions(contribData);
          setChatMessages(chatData);
        });
      } catch (err) {
        if (!cancelled) {
          console.error('Room loading error:', err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRoom();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, roomId]);

  useEffect(() => {
    if (!user || !roomId) return undefined;
    let cancelled = false;

    async function joinAndLoadMembers() {
      try {
        const response = await apiFetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, user_name: user.name, user_color: user.color }),
        });
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          if (payload.reason === 'removed') setMembershipStatus('removed');
          else if (payload.reason === 'entry_locked') setMembershipStatus('entry_locked');
          return;
        }
        if (!cancelled) {
          setMembershipStatus(null);
        }
      } catch {
        return;
      }

      try {
        const membersData = await requestJson(apiFetch, `/api/rooms/${roomId}/members`);
        if (!cancelled) {
          startTransition(() => setMembers(membersData));
        }
      } catch {
        // Ignore member refresh failures.
      }
    }

    joinAndLoadMembers();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, roomId, user]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    requestJson(apiFetch, `/api/notifications?user_id=${user.id}`)
      .then(data => {
        if (!cancelled) {
          startTransition(() => setNotifications(data));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [apiFetch, user]);

  const refreshMembers = async () => {
    const membersData = await requestJson(apiFetch, `/api/rooms/${roomId}/members`);
    setMembers(membersData);
    return membersData;
  };

  return {
    room,
    setRoom,
    contributions,
    setContributions,
    chatMessages,
    setChatMessages,
    members,
    setMembers,
    notifications,
    setNotifications,
    loading,
    error,
    membershipStatus,
    setMembershipStatus,
    refreshMembers,
  };
}
