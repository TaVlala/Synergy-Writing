import React from 'react';
import ContributionItem from './ContributionItem';

function ChatView({ contributions, currentUser, isCreator, onDelete, onEdit, onReact, onAddComment, onLoadComments, onPin }) {
  if (!Array.isArray(contributions) || contributions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <p>No contributions yet.</p>
        <p className="empty-sub">Be the first to write something!</p>
      </div>
    );
  }

  const pinned = contributions.find(c => c.pinned);
  const rest = contributions.filter(c => !c.pinned);

  const itemProps = { currentUser, isCreator, onDelete, onEdit, onReact, onAddComment, onLoadComments, onPin, onUpdateContent: onEdit };

  return (
    <div className="chat-view">
      {pinned && (
        <div className="pinned-banner">
          <div className="pinned-banner-label">
            <span className="pinned-icon">📌</span>
            <span>Pinned by admin</span>
          </div>
          <ContributionItem key={pinned.id} contribution={pinned} {...itemProps} />
        </div>
      )}
      {rest.map(contribution => (
        <ContributionItem
          key={contribution.id}
          contribution={contribution}
          {...itemProps}
        />
      ))}
    </div>
  );
}

export default ChatView;
