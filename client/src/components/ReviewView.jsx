import React from 'react';
import { getAuthorColor, formatTime } from '../utils';

function ReviewView({ contributions, currentUser, isCreator, onApprove, onReject, onReorder }) {
  const pending = contributions
    .filter(c => c.status === 'pending')
    .sort((a, b) => a.created_at - b.created_at);

  const approved = contributions
    .filter(c => (c.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order || a.created_at) - (b.sort_order || b.created_at));

  const rejected = contributions.filter(c => c.status === 'rejected');

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const newOrder = [...approved];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    onReorder(newOrder.map(c => c.id));
  };

  const handleMoveDown = (idx) => {
    if (idx === approved.length - 1) return;
    const newOrder = [...approved];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    onReorder(newOrder.map(c => c.id));
  };

  return (
    <div className="review-view">

      {/* ── Pending section ── */}
      <section className="review-section">
        <div className="review-section-header">
          <span className="review-section-icon">⏳</span>
          <h2 className="review-section-title">Pending Review</h2>
          {pending.length > 0 && (
            <span className="review-count review-count--pending">{pending.length}</span>
          )}
          {!isCreator && pending.length > 0 && (
            <span className="review-section-hint">Waiting for admin approval</span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="review-empty">
            {isCreator ? 'No contributions awaiting review. All caught up!' : 'Nothing in the queue right now.'}
          </p>
        ) : (
          <div className="review-list">
            {pending.map(c => {
              const color = c.author_color || getAuthorColor(c.author_id);
              const isOwn = c.author_id === currentUser?.id;
              return (
                <div key={c.id} className={`review-card review-card--pending${isOwn ? ' review-card--own' : ''}`}>
                  <div className="review-card-header">
                    <span className="review-card-avatar" style={{ background: color }}>
                      {c.author_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="review-card-author" style={{ color }}>
                      {c.author_name}
                    </span>
                    {isOwn && <span className="review-card-you">you</span>}
                    <span className="review-card-time">{formatTime(c.created_at)}</span>
                  </div>
                  <p className="review-card-content">{c.content}</p>
                  {isCreator && (
                    <div className="review-card-actions">
                      <button className="btn-approve" onClick={() => onApprove(c.id)}>
                        ✓ Approve
                      </button>
                      <button className="btn-reject" onClick={() => onReject(c.id)}>
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Approved / Document Order section ── */}
      <section className="review-section">
        <div className="review-section-header">
          <span className="review-section-icon">📄</span>
          <h2 className="review-section-title">Document Order</h2>
          {approved.length > 0 && (
            <span className="review-count review-count--approved">{approved.length}</span>
          )}
          {isCreator && approved.length > 1 && (
            <span className="review-section-hint">Use ▲ ▼ to reorder</span>
          )}
        </div>

        {approved.length === 0 ? (
          <p className="review-empty">No approved contributions yet.</p>
        ) : (
          <div className="review-list">
            {approved.map((c, idx) => {
              const color = c.author_color || getAuthorColor(c.author_id);
              return (
                <div key={c.id} className="review-card review-card--approved">
                  <div className="review-card-position">
                    <span className="review-pos-number">#{idx + 1}</span>
                    {isCreator && (
                      <div className="review-movers">
                        <button
                          className="move-btn"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          title="Move up"
                        >▲</button>
                        <button
                          className="move-btn"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === approved.length - 1}
                          title="Move down"
                        >▼</button>
                      </div>
                    )}
                  </div>
                  <div className="review-card-body">
                    <div className="review-card-header">
                      <span className="review-card-avatar" style={{ background: color }}>
                        {c.author_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="review-card-author" style={{ color }}>
                        {c.author_name}
                      </span>
                      <span className="review-card-time">{formatTime(c.created_at)}</span>
                    </div>
                    <p className="review-card-content">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Rejected section (admin only) ── */}
      {isCreator && rejected.length > 0 && (
        <section className="review-section review-section--collapsed">
          <div className="review-section-header">
            <span className="review-section-icon">✕</span>
            <h2 className="review-section-title">Rejected</h2>
            <span className="review-count review-count--rejected">{rejected.length}</span>
          </div>
          <div className="review-list">
            {rejected.map(c => {
              const color = c.author_color || getAuthorColor(c.author_id);
              return (
                <div key={c.id} className="review-card review-card--rejected">
                  <div className="review-card-header">
                    <span className="review-card-avatar" style={{ background: color }}>
                      {c.author_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="review-card-author" style={{ color }}>
                      {c.author_name}
                    </span>
                    <span className="review-card-time">{formatTime(c.created_at)}</span>
                  </div>
                  <p className="review-card-content">{c.content}</p>
                  <div className="review-card-actions">
                    <button className="btn-approve" onClick={() => onApprove(c.id)}>
                      ↩ Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default ReviewView;
