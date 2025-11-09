// src/contexts/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  getUserNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  NOTIFICATION_TYPES
} from '../firebase/taskNotifications';
import notificationCacheService from '../services/notificationCacheService';
import { readCounter } from '../services/readCounter';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { firestore } from '../firebase/config';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { userProfile, organization } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef(null);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!userProfile?.id || !organization?.id) return;

    setLoading(true);
    try {
      // Check cache first
      const cached = notificationCacheService.getCachedNotifications(userProfile.id, organization.id);
      if (cached) {
        setNotifications(cached);
        setUnreadCount(cached.filter(n => !n.read).length);
        readCounter.recordCacheHit('taskNotifications', 'NotificationContext', cached.length);
      } else {
        readCounter.recordCacheMiss('taskNotifications', 'NotificationContext');
      }

      // Fetch from Firestore
      const allNotifications = await getUserNotifications(userProfile.id, organization.id, 50);
      setNotifications(allNotifications);
      setUnreadCount(allNotifications.filter(n => !n.read).length);

      // Cache the results
      notificationCacheService.setCachedNotifications(userProfile.id, organization.id, allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, organization?.id]);

  // Set up real-time listener for new notifications
  useEffect(() => {
    if (!userProfile?.id || !organization?.id) return;

    const latestTimestamp = notificationCacheService.getLatestTimestamp(userProfile.id, organization.id);

    const q = latestTimestamp
      ? query(
          collection(firestore, 'taskNotifications'),
          where('userId', '==', userProfile.id),
          where('organizationID', '==', organization.id),
          where('createdAt', '>', Timestamp.fromMillis(latestTimestamp)),
          orderBy('createdAt', 'desc')
        )
      : query(
          collection(firestore, 'taskNotifications'),
          where('userId', '==', userProfile.id),
          where('organizationID', '==', organization.id),
          where('read', '==', false),
          orderBy('createdAt', 'desc')
        );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const newNotifications = [];

      snapshot.forEach(doc => {
        newNotifications.push({
          id: doc.id,
          ...doc.data()
        });
      });

      if (newNotifications.length > 0) {
        readCounter.recordRead('realtime', 'taskNotifications', 'NotificationContext', newNotifications.length);

        setNotifications(prev => {
          const updated = notificationCacheService.appendNewNotifications(
            userProfile.id,
            organization.id,
            newNotifications
          );
          return updated;
        });

        setUnreadCount(prev => prev + newNotifications.filter(n => !n.read).length);

        // Show desktop notification for first new notification
        if (newNotifications[0] && !newNotifications[0].read) {
          showDesktopNotification(newNotifications[0]);
        }
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userProfile?.id, organization?.id]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date() } : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));

      // Update cache
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      notificationCacheService.setCachedNotifications(userProfile.id, organization.id, updated);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [userProfile?.id, organization?.id, notifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead(userProfile.id, organization.id);

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, readAt: new Date() }))
      );

      setUnreadCount(0);

      // Update cache
      const updated = notifications.map(n => ({ ...n, read: true }));
      notificationCacheService.setCachedNotifications(userProfile.id, organization.id, updated);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [userProfile?.id, organization?.id, notifications]);

  // Delete notification
  const deleteNotif = useCallback(async (notificationId) => {
    try {
      await deleteNotification(notificationId);

      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== notificationId);
        notificationCacheService.setCachedNotifications(userProfile.id, organization.id, filtered);
        return filtered;
      });

      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.read ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [userProfile?.id, organization?.id, notifications]);

  // Show desktop notification
  const showDesktopNotification = (notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png',
        tag: notification.id
      });
    }
  };

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification: deleteNotif,
    refreshNotifications: loadNotifications,
    requestNotificationPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
