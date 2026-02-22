import React, { useState, useEffect, useRef } from 'react';
import { formatTime } from '../utils';

function ChatSidebar({ messages, currentUser, onSend, isOpen, onToggle }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message (only when open)
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText('');
      inputRef.current?.focus();
    } catch {
      // silently ignore — socket will still deliver the message
    }
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <aside className={`chat-sidebar${isOpen ? '' : ' chat-sidebar--collapsed'}`}>
      <div className="chat-sidebar-header">
        {isOpen && <span>💬 Live Chat</span>}
        <button
          className="chat-toggle-btn"
          onClick={onToggle}
          title={isOpen ? 'Collapse chat' : 'Expand chat'}
        >
          {isOpen ? '»' : '«'}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">No messages yet. Say hello!</p>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.author_id === currentUser?.id ? 'chat-message--own' : ''}`}>
                <span
                  className="chat-message-avatar"
                  style={{ background: msg.author_color || '#6366f1' }}
                  title={msg.author_name}
                >
                  {msg.author_name.charAt(0).toUpperCase()}
                </span>
                <div className="chat-message-body">
                  <div className="chat-message-meta">
                    <span className="chat-message-author" style={{ color: msg.author_color || '#6366f1' }}>
                      {msg.author_name}
                    </span>
                    <span className="chat-message-time">{formatTime(msg.created_at)}</span>
                  </div>
                  <p className="chat-message-content">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Message…"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={!currentUser}
            />
            <button
              className="btn btn-primary chat-send-btn"
              type="submit"
              disabled={!text.trim() || sending || !currentUser}
            >
              ↑
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

export default ChatSidebar;
