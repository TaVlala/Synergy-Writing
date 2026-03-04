import React, { useState, useEffect, useRef } from 'react';
import { Bell, PenLine, CornerDownLeft, MessageCircle } from 'lucide-react';
import { formatTime } from '../utils';

const TYPE_ICONS = {
  new_contribution: <PenLine size={14} />,
  reply: <CornerDownLeft size={14} />,
  comment: <MessageCircle size={14} />
};

function NotificationBell({ notifications, onMarkAllRead }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unread > 0) onMarkAllRead();
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        className={`notif-bell ${unread > 0 ? 'notif-bell--active' : ''}`}
        onClick={handleOpen}
        title="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="notif-count">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <button className="btn-link" onClick={onMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="notif-empty">Nothing new</p>
          ) : (
            <div className="notif-list">
              {notifications.slice(0, 25).map(n => (
                <div key={n.id} className={`notif-item ${n.is_read ? '' : 'notif-item--unread'}`}>
                  <span className="notif-icon">{TYPE_ICONS[n.type] || <Bell size={14} />}</span>
                  <div className="notif-body">
                    <p className="notif-message">{n.message}</p>
                    <time className="notif-time">{formatTime(n.created_at)}</time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
