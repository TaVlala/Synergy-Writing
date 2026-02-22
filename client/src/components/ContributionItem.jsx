import React, { useState, useEffect, useRef } from 'react';
import CommentSection from './CommentSection';
import { getAuthorColor, formatTime } from '../utils';

const REACTIONS = ['👍', '❤️', '😄', '🔥', '✨'];

function ContributionItem({ contribution, currentUser, isCreator, onDelete, onReact, onAddComment, onLoadComments }) {
  const [showComments, setShowComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  const authorColor = getAuthorColor(contribution.author_id);
  const isOwn = contribution.author_id === currentUser?.id;
  const canDelete = isOwn || isCreator;

  // Close picker when clicking outside
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e) => {
      if (!pickerRef.current?.contains(e.target)) setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // Group reactions: { emoji -> { count, hasMe } }
  const reactionGroups = REACTIONS.reduce((acc, emoji) => {
    const matching = (contribution.reactions || []).filter(r => r.emoji === emoji);
    if (matching.length > 0) {
      acc[emoji] = {
        count: matching.length,
        hasMe: matching.some(r => r.user_id === currentUser?.id)
      };
    }
    return acc;
  }, {});

  const handleToggleComments = async () => {
    if (!commentsLoaded && contribution.comments === undefined) {
      await onLoadComments(contribution.id);
    }
    setCommentsLoaded(true);
    setShowComments(v => !v);
  };

  const hasCommentData = commentsLoaded || contribution.comments !== undefined;
  const commentCount = contribution.comments?.length ?? 0;

  return (
    <article className={`contribution ${isOwn ? 'contribution--own' : ''}`}>
      {/* Header */}
      <div className="contribution-header">
        <span
          className="author-avatar"
          style={{ background: authorColor }}
          title={contribution.author_name}
        >
          {contribution.author_name.charAt(0).toUpperCase()}
        </span>
        <span className="author-name">{contribution.author_name}</span>
        <time className="contribution-time" dateTime={new Date(contribution.created_at).toISOString()}>
          {formatTime(contribution.created_at)}
        </time>
        {canDelete && (
          <button
            className="delete-btn"
            onClick={() => onDelete(contribution.id)}
            title="Delete contribution"
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div className="contribution-body">
        <p>{contribution.content}</p>
      </div>

      {/* Footer: reactions + comment toggle */}
      <div className="contribution-footer">
        <div className="reactions-row">
          {Object.entries(reactionGroups).map(([emoji, { count, hasMe }]) => (
            <button
              key={emoji}
              className={`reaction-chip ${hasMe ? 'reaction-chip--active' : ''}`}
              onClick={() => onReact(contribution.id, emoji)}
            >
              {emoji} {count}
            </button>
          ))}
          <div className="reaction-picker-wrap" ref={pickerRef}>
            <button
              className="add-reaction-btn"
              onClick={() => setShowPicker(v => !v)}
              title="Add reaction"
            >
              + 😊
            </button>
            {showPicker && (
              <div className="reaction-picker">
                {REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-option"
                    onClick={() => { onReact(contribution.id, emoji); setShowPicker(false); }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button className="comment-toggle" onClick={handleToggleComments}>
          💬 {hasCommentData ? commentCount : '…'} comment{commentCount !== 1 ? 's' : ''}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection
          contributionId={contribution.id}
          comments={contribution.comments || []}
          currentUser={currentUser}
          onAddComment={onAddComment}
        />
      )}
    </article>
  );
}

export default ContributionItem;
