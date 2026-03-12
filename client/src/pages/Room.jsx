import React, { Suspense, lazy, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock, SquarePen, Swords } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../App';
import ChatView from '../components/ChatView';
import ContributorsPanel from '../components/ContributorsPanel';
import DocumentView from '../components/DocumentView';
import HangmanGame from '../components/HangmanGame';
import ReviewView from '../components/ReviewView';
import RichEditor from '../components/RichEditor';
import RoomHeader from '../components/RoomHeader';
import SidebarComponent from '../components/SidebarComponent';
import WordLadder from '../components/WordLadder';
import WordleGame from '../components/WordleGame';
import { useRoomData } from '../hooks/useRoomData';
import { useRoomExports } from '../hooks/useRoomExports';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { APP_COLORS } from '../utils';
import { createJsonOptions, requestJson } from '../lib/api';

const ChatSidebar = lazy(() => import('../components/ChatSidebar'));

const GAME_LABELS = {
  wordle: 'Wordle',
  hangman: 'Hangman',
  wordladder: 'Word Ladder',
};

function Room() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { user, apiFetch, authToken, theme, toggleTheme } = useUser();

  const [view, setView] = useState('collab');
  const [editorHTML, setEditorHTML] = useState('');
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showContributors, setShowContributors] = useState(false);
  const [showWordle, setShowWordle] = useState(false);
  const [showHangman, setShowHangman] = useState(false);
  const [showWordLadder, setShowWordLadder] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState(null);
  const [composerExpanded, setComposerExpanded] = useState(false);

  const editorRef = useRef(null);
  const exportMenuRef = useRef(null);
  const bottomRef = useRef(null);

  const {
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
  } = useRoomData({ roomId, user, apiFetch });

  const {
    onlineUsers,
    otherCursors,
    incomingChallenge,
    gameSession,
    opponentResult,
    challengeMsg,
    emitTyping,
    emitCursorUpdate,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    emitVsResult,
    clearGameSession,
  } = useRoomSocket({
    roomId,
    authToken,
    user,
    setRoom,
    setContributions,
    setChatMessages,
    setMembers,
    setNotifications,
    setMembershipStatus,
  });

  const deferredContributions = useDeferredValue(contributions);
  const deferredNotifications = useDeferredValue(notifications);

  useEffect(() => {
    if (view === 'collab') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [deferredContributions, view]);

  const showTransientError = message => {
    setPostError(message);
    setTimeout(() => setPostError(''), 4000);
  };

  const { handleExportTxt, exportAsPDF, exportAsWord, handleExportEpub } = useRoomExports({
    room,
    contributions,
    roomId,
    apiFetch,
    onError: showTransientError,
    onComplete: () => setShowExportMenu(false),
  });

  const isCreator = room?.creator_id && user?.id && room.creator_id === user.id;

  const collabContributions = deferredContributions.filter(item => (
    item.status !== 'rejected' || (user?.id && item.author_id === user.id) || isCreator
  ));
  const documentContributions = deferredContributions
    .filter(item => (item.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order || a.created_at) - (b.sort_order || b.created_at));

  const openGamePanel = game => {
    setShowWordle(game === 'wordle');
    setShowHangman(game === 'hangman');
    setShowWordLadder(game === 'wordladder');
  };

  const closeGames = () => {
    setShowWordle(false);
    setShowHangman(false);
    setShowWordLadder(false);
    clearGameSession();
  };

  const handleSubmit = async event => {
    event?.preventDefault?.();
    if (editorEmpty || !user || submitting || room?.is_locked) return;
    setSubmitting(true);
    try {
      await requestJson(
        apiFetch,
        `/api/rooms/${roomId}/contributions`,
        createJsonOptions('POST', {
          author_id: user.id,
          author_name: user.name,
          author_color: user.color || APP_COLORS[5],
          content: editorHTML,
        })
      );
      editorRef.current?.clearContent();
      setEditorHTML('');
      setEditorEmpty(true);
    } catch (err) {
      showTransientError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditContribution = async (id, newContent) => {
    await requestJson(apiFetch, `/api/contributions/${id}`, createJsonOptions('PATCH', { user_id: user.id, content: newContent }));
  };

  const handlePinContribution = async (id, pinned) => {
    await requestJson(apiFetch, `/api/rooms/${roomId}/contributions/${id}/pin`, createJsonOptions('PATCH', { user_id: user.id, pinned }));
  };

  const handleApproveContribution = async id => {
    await requestJson(apiFetch, `/api/contributions/${id}/status`, createJsonOptions('PATCH', { user_id: user.id, status: 'approved' }));
  };

  const handleRejectContribution = async id => {
    await requestJson(apiFetch, `/api/contributions/${id}/status`, createJsonOptions('PATCH', { user_id: user.id, status: 'rejected' }));
  };

  const handleReorderContributions = async orderedIds => {
    await requestJson(apiFetch, `/api/rooms/${roomId}/reorder`, createJsonOptions('PATCH', { user_id: user.id, order: orderedIds }));
  };

  const handleDeleteContribution = id => {
    setConfirmDialog({
      message: 'Delete this contribution?',
      onConfirm: async () => {
        await requestJson(apiFetch, `/api/contributions/${id}`, createJsonOptions('DELETE', { user_id: user.id }));
      },
    });
  };

  const handleReaction = async (contributionId, emoji) => {
    if (!user) return;
    await requestJson(apiFetch, `/api/contributions/${contributionId}/reactions`, createJsonOptions('POST', { user_id: user.id, emoji }));
  };

  const handleAddComment = async (contributionId, content, parentId = null, inlineId = null) => {
    if (!user || !content.trim()) return null;
    return requestJson(apiFetch, `/api/contributions/${contributionId}/comments`, createJsonOptions('POST', {
      author_id: user.id,
      author_name: user.name,
      content: content.trim(),
      parent_id: parentId,
      inline_id: inlineId,
    }));
  };

  const handleLoadComments = async contributionId => {
    const comments = await requestJson(apiFetch, `/api/contributions/${contributionId}/comments`);
    setContributions(prev => prev.map(item => (item.id === contributionId ? { ...item, comments } : item)));
    return comments;
  };

  const handleSendChat = async content => {
    if (!user) return;
    await requestJson(apiFetch, `/api/rooms/${roomId}/chat`, createJsonOptions('POST', {
      author_id: user.id,
      author_name: user.name,
      author_color: user.color || APP_COLORS[5],
      content,
    }));
  };

  const handleContribLockToggle = async () => {
    if (!user || !room) return;
    await requestJson(apiFetch, `/api/rooms/${roomId}`, createJsonOptions('PATCH', { user_id: user.id, is_locked: !room.is_locked }));
  };

  const handleEntryLockToggle = async () => {
    if (!user || !room) return;
    await requestJson(apiFetch, `/api/rooms/${roomId}`, createJsonOptions('PATCH', { user_id: user.id, is_entry_locked: !room.is_entry_locked }));
  };

  const handleRemoveMember = targetUserId => {
    if (!user || !isCreator) return;
    setConfirmDialog({
      message: 'Remove this contributor from the room?',
      onConfirm: async () => {
        await requestJson(apiFetch, `/api/rooms/${roomId}/members/${targetUserId}`, createJsonOptions('DELETE', { user_id: user.id }));
        await refreshMembers();
      },
    });
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    await requestJson(apiFetch, '/api/notifications/read-all', createJsonOptions('PATCH', { user_id: user.id }));
    setNotifications(prev => prev.map(item => ({ ...item, is_read: 1 })));
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    const fallbackCopy = () => {
      const element = document.createElement('textarea');
      element.value = url;
      element.style.position = 'fixed';
      element.style.opacity = '0';
      document.body.appendChild(element);
      element.select();
      document.execCommand('copy');
      document.body.removeChild(element);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }

    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!user) return <Navigate to="/auth" replace />;
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (error) {
    return (
      <div className="error-screen">
        <h2>Room not found</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (membershipStatus === 'removed') {
    return (
      <div className="error-screen">
        <h2>You've been removed</h2>
        <p>The room admin has removed you from this room.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (membershipStatus === 'entry_locked') {
    return (
      <div className="error-screen">
        <h2>Room is closed</h2>
        <p>This room is no longer accepting new contributors.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="room-layout">
      <RoomHeader
        room={room}
        user={user}
        navigate={navigate}
        view={view}
        setView={setView}
        handleCopyLink={handleCopyLink}
        linkCopied={linkCopied}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        handleExportTxt={handleExportTxt}
        handleExportPdf={exportAsPDF}
        handleExportDocx={exportAsWord}
        handleExportEpub={handleExportEpub}
        exportMenuRef={exportMenuRef}
        onlineUsers={onlineUsers}
        members={members}
        showWordle={showWordle}
        setShowWordle={setShowWordle}
        showHangman={showHangman}
        setShowHangman={setShowHangman}
        showWordLadder={showWordLadder}
        setShowWordLadder={setShowWordLadder}
        setShowContributors={setShowContributors}
        handleEntryLockToggle={handleEntryLockToggle}
        handleContribLockToggle={handleContribLockToggle}
        toggleTheme={toggleTheme}
        theme={theme}
        notifications={deferredNotifications}
        markAllNotificationsRead={markAllNotificationsRead}
      />

      <div className="room-body">
        {view === 'collab' && (
          <Suspense fallback={<div className="sidebar-loading-placeholder" />}>
            <ChatSidebar
              isOpen={chatOpen}
              onToggle={() => setChatOpen(open => !open)}
              currentUser={user}
              messages={chatMessages}
              onSend={handleSendChat}
            />
          </Suspense>
        )}

        <main className="room-main">
          {view === 'collab' && (
            <ChatView
              contributions={collabContributions}
              currentUser={user}
              isCreator={isCreator}
              onDelete={handleDeleteContribution}
              onEdit={handleEditContribution}
              onReact={handleReaction}
              onAddComment={handleAddComment}
              onLoadComments={handleLoadComments}
              onPin={handlePinContribution}
              activeCommentId={activeCommentId}
              onToggleComments={id => setActiveCommentId(prev => (prev === id ? null : id))}
            />
          )}
          {view === 'review' && (
            <ReviewView
              contributions={contributions}
              currentUser={user}
              isCreator={isCreator}
              onApprove={handleApproveContribution}
              onReject={handleRejectContribution}
              onReorder={handleReorderContributions}
            />
          )}
          {view === 'document' && <DocumentView contributions={documentContributions} roomTitle={room?.title} />}
          <div ref={bottomRef} />
        </main>

        {view === 'collab' && (
          <SidebarComponent
            activeCommentId={activeCommentId}
            setActiveCommentId={setActiveCommentId}
            contributions={contributions}
            user={user}
            onAddComment={handleAddComment}
          />
        )}
      </div>

      {view === 'collab' && (
        room?.is_locked ? (
          <footer className="room-footer locked-footer">
            <span><Lock size={14} /> This room is locked - no new contributions can be added.</span>
          </footer>
        ) : (
          <footer className="room-footer">
            {composerExpanded ? (
              <form className="contribution-form" onSubmit={handleSubmit}>
                <div className="composer-header">
                  <div className="composer-title">
                    <SquarePen size={15} />
                    <span>New contribution</span>
                  </div>
                  <button
                    type="button"
                    className="composer-toggle"
                    onClick={() => setComposerExpanded(false)}
                    title="Collapse composer"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <RichEditor
                  ref={editorRef}
                  placeholder="Write something..."
                  otherCursors={otherCursors}
                  currentUserName={user?.name}
                  showCommentBubble={false}
                  onChange={(html, isEmpty) => {
                    setEditorHTML(html);
                    setEditorEmpty(isEmpty);
                    emitTyping();
                  }}
                  onSelectionUpdate={emitCursorUpdate}
                  onSubmit={handleSubmit}
                />
                <div className="form-actions">
                  <span className="form-hint">Ctrl + Enter to post</span>
                  {postError && <span className="form-error">{postError}</span>}
                  <button className="btn btn-primary" type="submit" disabled={submitting || editorEmpty}>
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="composer-collapsed">
                <div className="composer-collapsed-copy">
                  <span className="composer-collapsed-title">New contribution</span>
                  <span className="composer-collapsed-sub">Expand the editor when you're ready to write.</span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary composer-open-btn"
                  onClick={() => {
                    setComposerExpanded(true);
                    setTimeout(() => editorRef.current?.focus(), 0);
                  }}
                >
                  <SquarePen size={15} /> Write
                </button>
              </div>
            )}
          </footer>
        )
      )}

      {showContributors && (
        <ContributorsPanel
          isOpen={showContributors}
          onClose={() => setShowContributors(false)}
          members={members}
          currentUser={user}
          isCreator={room?.creator_id === user?.id}
          roomId={roomId}
          onRemove={handleRemoveMember}
        />
      )}

      {showWordle && (
        <WordleGame
          onClose={closeGames}
          members={members}
          currentUser={user}
          onSendChallenge={(toId, toName) => sendChallenge({ toUserId: toId, toUserName: toName, game: 'wordle' })}
          vsSession={gameSession?.game === 'wordle' ? gameSession : null}
          opponentResult={gameSession?.game === 'wordle' ? opponentResult : null}
          onVsResult={emitVsResult}
        />
      )}

      {showHangman && (
        <HangmanGame
          onClose={closeGames}
          members={members}
          currentUser={user}
          onSendChallenge={(toId, toName, customWord) => sendChallenge({ toUserId: toId, toUserName: toName, game: 'hangman', customWord })}
          vsSession={gameSession?.game === 'hangman' ? gameSession : null}
          opponentResult={gameSession?.game === 'hangman' ? opponentResult : null}
          onVsResult={emitVsResult}
        />
      )}

      {showWordLadder && (
        <WordLadder
          onClose={closeGames}
          members={members}
          currentUser={user}
          onSendChallenge={(toId, toName) => sendChallenge({ toUserId: toId, toUserName: toName, game: 'wordladder' })}
          vsSession={gameSession?.game === 'wordladder' ? gameSession : null}
          opponentResult={gameSession?.game === 'wordladder' ? opponentResult : null}
          onVsResult={emitVsResult}
        />
      )}

      {incomingChallenge && (
        <div className="challenge-toast">
          <span><Swords size={15} /> <strong>{incomingChallenge.fromUser?.name}</strong> challenges you to {GAME_LABELS[incomingChallenge.game] || incomingChallenge.game}!</span>
          <div className="challenge-toast-actions">
            <button className="btn-sm btn-primary" onClick={() => { const session = acceptChallenge(); openGamePanel(session?.game); }}>Accept</button>
            <button className="btn-sm btn-secondary" onClick={declineChallenge}>Decline</button>
          </div>
        </div>
      )}

      {challengeMsg && !incomingChallenge && <div className="challenge-toast challenge-toast--decline">{challengeMsg}</div>}

      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <p className="modal-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setConfirmDialog(null);
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Room;


