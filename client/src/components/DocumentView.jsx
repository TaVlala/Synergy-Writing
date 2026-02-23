import React from 'react';
import { getAuthorColor } from '../utils';

function DocumentView({ contributions, roomTitle }) {
  if (contributions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📄</div>
        <p>No content yet.</p>
        <p className="empty-sub">Switch to Chat view to start writing.</p>
      </div>
    );
  }

  const authors = [...new Set(contributions.map(c => c.author_name))];

  return (
    <div className="document-view">
      {roomTitle && <h1 className="document-title">{roomTitle}</h1>}

      <div className="document-byline">
        {authors.map((name, i) => (
          <span key={name} className="document-author" style={{ color: getAuthorColor(contributions.find(c => c.author_name === name)?.author_id) }}>
            {name}{i < authors.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>

      <div className="document-body">
        {contributions.map((c) => (
          /<[a-z][\s\S]*>/i.test(c.content)
            ? <div key={c.id} className="document-paragraph rich-content" dangerouslySetInnerHTML={{ __html: c.content }} />
            : <p key={c.id} className="document-paragraph" style={{ whiteSpace: 'pre-wrap' }}>{c.content}</p>
        ))}
      </div>

      <div className="document-meta">
        {contributions.length} contribution{contributions.length !== 1 ? 's' : ''} by {authors.length} author{authors.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default DocumentView;
