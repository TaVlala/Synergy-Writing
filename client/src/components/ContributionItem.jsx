import React, { useState, useEffect, useRef } from 'react';
import CommentSection from './CommentSection';
import RichEditor from './RichEditor';
import { getAuthorColor, formatTime } from '../utils';

// function renderContent is moved inside ContributionItem to access state

const REACTIONS = ['👍', '❤️', '😄', '🔥', '✨'];

function ContributionItem({ contribution, currentUser, isCreator, onDelete, onEdit, onReact, onAddComment, onLoadComments, onPin, onUpdateContent }) {
  const [showComments, setShowComments] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(contribution.content);
  const [editEmpty, setEditEmpty] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [activeInlineId, setActiveInlineId] = useState(null);
  const pickerRef = useRef(null);
  const editRef = useRef(null);

  const handleInlineCommentClick = (commentId) => {
    setActiveInlineId(commentId);
    setShowComments(true);
  };

  const handleInlineCommentCreate = async (commentId, updatedHTML) => {
    await onUpdateContent?.(contribution.id, updatedHTML);
    setActiveInlineId(commentId);
    setShowComments(true);
  };

  const handleHighlightUpdate = async (updatedHTML) => {
    await onUpdateContent?.(contribution.id, updatedHTML);
  };

  const authorColor = contribution.author_color || getAuthorColor(contribution.author_id);
  const isOwn = contribution.author_id === currentUser?.id;
  const canDelete = isOwn || isCreator;
  const canEdit = isOwn;

  const handleEditStart = () => {
    setEditText(contribution.content);
    setEditEmpty(false);
    setEditError('');
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setEditError('');
  };

  const handleEditSave = async () => {
    if (editEmpty || editText === contribution.content) {
      setEditing(false);
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      await onEdit(contribution.id, editText.trim());
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    }
    setEditSaving(false);
  };

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
    <article
      className={`contribution ${isOwn ? 'contribution--own' : ''} ${contribution.pinned ? 'contribution--pinned' : ''}`}
      style={{ borderLeftColor: authorColor, borderLeftWidth: '4px' }}
    >
      {/* Header */}
      <div className="contribution-header">
        <span
          className="author-avatar"
          style={{ background: authorColor }}
          title={contribution.author_name}
        >
          {(contribution.author_name || 'Anonymous').charAt(0).toUpperCase()}
        </span>
        <span className="author-name">{contribution.author_name}</span>
        <time className="contribution-time" dateTime={new Date(contribution.created_at).toISOString()}>
          {formatTime(contribution.created_at)}
          {contribution.edited_at && <span className="edited-label"> (edited)</span>}
        </time>
        {contribution.status === 'pending' && (
          <span className="contrib-status-badge contrib-status-badge--pending">Pending</span>
        )}
        {contribution.status === 'rejected' && (
          <span className="contrib-status-badge contrib-status-badge--rejected">Rejected</span>
        )}
        {isCreator && !editing && (
          <button
            className={`pin-btn${contribution.pinned ? ' pin-btn--active' : ''}`}
            onClick={() => onPin(contribution.id, !contribution.pinned)}
            title={contribution.pinned ? 'Unpin' : 'Pin to top'}
          >
            📌
          </button>
        )}
        {canEdit && !editing && (
          <button className="edit-btn" onClick={handleEditStart} title="Edit contribution">
            ✎
          </button>
        )}
        {canDelete && !editing && (
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
        {editing ? (
          <div className="edit-form">
            {contribution.status === 'approved' && (
              <p className="edit-reapproval-warning">⚠️ Saving will remove this from the document until re-approved by admin.</p>
            )}
            <RichEditor
              ref={editRef}
              initialContent={editText}
              onChange={(html, isEmpty) => { setEditText(html); setEditEmpty(isEmpty); }}
              onSubmit={handleEditSave}
            />
            {editError && <p className="edit-error">{editError}</p>}
            <div className="edit-actions">
              <button className="btn btn-secondary" onClick={handleEditCancel} disabled={editSaving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving || editEmpty}>
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rich-content">
            <RichEditor
              initialContent={contribution.content}
              editable={false}
              currentUserName={currentUser?.name}
              onCommentClick={handleInlineCommentClick}
              onInlineCommentCreate={handleInlineCommentCreate}
              onHighlightUpdate={handleHighlightUpdate}
            />
          </div>
        )}
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
          activeInlineId={activeInlineId}
          onResetInline={() => setActiveInlineId(null)}
        />
      )}
    </article>
  );
}

export default ContributionItem;
