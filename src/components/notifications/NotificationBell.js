// src/components/notifications/NotificationBell.js
import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationPanel from './NotificationPanel';
import './NotificationBell.css';

const NotificationBell = () => {
  const { unreadCount } = useNotifications();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(prev => !prev);
  };

  return (
    <div className="notification-bell">
      <button
        className="notification-bell__button"
        onClick={togglePanel}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-bell__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      <NotificationPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  );
};

export default NotificationBell;
