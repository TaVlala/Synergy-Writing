import React from 'react';
import ContributionItem from './ContributionItem';

function ChatView({ contributions, currentUser, isCreator, onDelete, onReact, onAddComment, onLoadComments }) {
  if (contributions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <p>No contributions yet.</p>
        <p className="empty-sub">Be the first to write something!</p>
      </div>
    );
  }

  return (
    <div className="chat-view">
      {contributions.map(contribution => (
        <ContributionItem
          key={contribution.id}
          contribution={contribution}
          currentUser={currentUser}
          isCreator={isCreator}
          onDelete={onDelete}
          onReact={onReact}
          onAddComment={onAddComment}
          onLoadComments={onLoadComments}
        />
      ))}
    </div>
  );
}

export default ChatView;
