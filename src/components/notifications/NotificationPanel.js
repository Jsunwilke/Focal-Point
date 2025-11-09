// src/components/notifications/NotificationPanel.js
import React, { useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Clock, AlertCircle } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './NotificationPanel.css';

const NotificationPanel = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to task
    if (notification.taskId) {
      navigate(`/tasks?taskId=${notification.taskId}`);
      onClose();
    }
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'mention':
        return <Bell size={16} />;
      case 'assignment':
        return <AlertCircle size={16} />;
      case 'due_date_soon':
      case 'due_date_overdue':
        return <Clock size={16} />;
      default:
        return <Bell size={16} />;
    }
  };

  return (
    <div ref={panelRef} className="notification-panel">
      <div className="notification-panel__header">
        <div className="notification-panel__title">
          <Bell size={20} />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="notification-panel__unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="notification-panel__actions">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="notification-panel__action-btn"
              title="Mark all as read"
            >
              <CheckCheck size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="notification-panel__action-btn"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="notification-panel__content">
        {notifications.length === 0 ? (
          <div className="notification-panel__empty">
            <Bell size={48} />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="notification-panel__list">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-panel__item ${!notification.read ? 'notification-panel__item--unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-panel__item-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-panel__item-content">
                  <div className="notification-panel__item-title">{notification.title}</div>
                  <div className="notification-panel__item-message">{notification.message}</div>
                  <div className="notification-panel__item-time">{formatTime(notification.createdAt)}</div>
                </div>
                <div className="notification-panel__item-actions">
                  {!notification.read && (
                    <button
                      onClick={(e) => handleMarkAsRead(e, notification.id)}
                      className="notification-panel__item-action"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, notification.id)}
                    className="notification-panel__item-action notification-panel__item-action--delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
