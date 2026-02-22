import React, { useState } from 'react';
import { getAuthorColor, formatTime } from '../utils';

function Comment({ comment, depth, onReply }) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const authorColor = getAuthorColor(comment.author_id);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    await onReply(replyText.trim(), comment.id);
    setReplyText('');
    setShowReply(false);
  };

  return (
    <div className="comment" style={{ marginLeft: depth * 18 + 'px' }}>
      <div className="comment-header">
        <span className="comment-avatar" style={{ background: authorColor }}>
          {comment.author_name.charAt(0).toUpperCase()}
        </span>
        <span className="comment-author">{comment.author_name}</span>
        <time className="comment-time">{formatTime(comment.created_at)}</time>
      </div>
      <p className="comment-text">{comment.content}</p>
      {depth < 3 && (
        <button className="reply-link" onClick={() => setShowReply(v => !v)}>
          {showReply ? 'Cancel' : 'Reply'}
        </button>
      )}
      {showReply && (
        <div className="reply-row">
          <input
            className="input input--sm"
            type="text"
            placeholder="Write a reply…"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReply()}
            autoFocus
          />
          <button
            className="btn btn-sm"
            onClick={handleReply}
            disabled={!replyText.trim()}
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}

function CommentSection({ contributionId, comments, currentUser, onAddComment }) {
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    await onAddComment(contributionId, newComment.trim());
    setNewComment('');
    setSubmitting(false);
  };

  // Build tree
  const rootComments = comments.filter(c => !c.parent_id);
  const getChildren = (id) => comments.filter(c => c.parent_id === id);

  const renderTree = (comment, depth = 0) => (
    <React.Fragment key={comment.id}>
      <Comment
        comment={comment}
        depth={depth}
        onReply={(text, parentId) => onAddComment(contributionId, text, parentId)}
      />
      {getChildren(comment.id).map(child => renderTree(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="comment-section">
      <div className="comment-list">
        {rootComments.length === 0
          ? <p className="no-comments">No comments yet.</p>
          : rootComments.map(c => renderTree(c))
        }
      </div>

      {currentUser && (
        <div className="add-comment-row">
          <input
            className="input input--sm"
            type="text"
            placeholder="Add a comment…"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <button
            className="btn btn-sm"
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? '…' : 'Comment'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CommentSection;
