// src/firebase/taskNotifications.js
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';

// Notification types
export const NOTIFICATION_TYPES = {
  MENTION: 'mention',
  ASSIGNMENT: 'assignment',
  DUE_DATE_SOON: 'due_date_soon',
  DUE_DATE_OVERDUE: 'due_date_overdue',
  COMMENT: 'comment',
  STATUS_CHANGE: 'status_change',
  PRIORITY_CHANGE: 'priority_change',
  SUBTASK_COMPLETED: 'subtask_completed',
  TASK_COMPLETED: 'task_completed'
};

/**
 * Create a notification for a user
 */
export const createNotification = async ({
  userId,
  organizationID,
  taskId,
  type,
  title,
  message,
  triggeredBy,
  data = {}
}) => {
  try {
    const notificationData = {
      userId,
      organizationID,
      taskId,
      type,
      title,
      message,
      triggeredBy,
      data,
      read: false,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(firestore, 'taskNotifications'), notificationData);

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Create notifications for mentions in a comment
 */
export const createMentionNotifications = async ({
  mentions,
  taskId,
  taskTitle,
  commentText,
  triggeredBy,
  triggeredByName,
  organizationID
}) => {
  try {
    const notificationPromises = mentions.map(mention => {
      // Don't notify if user mentions themselves
      if (mention.userId === triggeredBy) return null;

      return createNotification({
        userId: mention.userId,
        organizationID,
        taskId,
        type: NOTIFICATION_TYPES.MENTION,
        title: `${triggeredByName} mentioned you`,
        message: `You were mentioned in a comment on "${taskTitle}"`,
        triggeredBy,
        data: {
          commentText: commentText.substring(0, 200), // First 200 chars
          mentionName: mention.userName
        }
      });
    });

    const results = await Promise.all(notificationPromises.filter(p => p !== null));
    return results;
  } catch (error) {
    console.error('Error creating mention notifications:', error);
    throw error;
  }
};

/**
 * Create notification for task assignment
 */
export const createAssignmentNotification = async ({
  assignedUserId,
  taskId,
  taskTitle,
  triggeredBy,
  triggeredByName,
  organizationID
}) => {
  try {
    // Don't notify if user assigns to themselves
    if (assignedUserId === triggeredBy) return null;

    return await createNotification({
      userId: assignedUserId,
      organizationID,
      taskId,
      type: NOTIFICATION_TYPES.ASSIGNMENT,
      title: 'New task assigned to you',
      message: `${triggeredByName} assigned you to "${taskTitle}"`,
      triggeredBy,
      data: {}
    });
  } catch (error) {
    console.error('Error creating assignment notification:', error);
    throw error;
  }
};

/**
 * Create notifications for task assignments (multiple users)
 */
export const createAssignmentNotifications = async ({
  assignedUserIds,
  taskId,
  taskTitle,
  triggeredBy,
  triggeredByName,
  organizationID
}) => {
  try {
    const notificationPromises = assignedUserIds.map(userId => {
      return createAssignmentNotification({
        assignedUserId: userId,
        taskId,
        taskTitle,
        triggeredBy,
        triggeredByName,
        organizationID
      });
    });

    const results = await Promise.all(notificationPromises.filter(p => p !== null));
    return results;
  } catch (error) {
    console.error('Error creating assignment notifications:', error);
    throw error;
  }
};

/**
 * Create notification for due date reminder
 */
export const createDueDateNotification = async ({
  userId,
  taskId,
  taskTitle,
  dueDate,
  isOverdue,
  organizationID
}) => {
  try {
    const type = isOverdue ? NOTIFICATION_TYPES.DUE_DATE_OVERDUE : NOTIFICATION_TYPES.DUE_DATE_SOON;
    const title = isOverdue ? 'Task overdue' : 'Task due soon';
    const message = isOverdue
      ? `Task "${taskTitle}" is overdue`
      : `Task "${taskTitle}" is due soon`;

    return await createNotification({
      userId,
      organizationID,
      taskId,
      type,
      title,
      message,
      triggeredBy: 'system',
      data: { dueDate: dueDate.toISOString() }
    });
  } catch (error) {
    console.error('Error creating due date notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 */
export const getUserNotifications = async (userId, organizationID, limitCount = 50) => {
  try {
    const q = query(
      collection(firestore, 'taskNotifications'),
      where('userId', '==', userId),
      where('organizationID', '==', organizationID),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const notifications = [];

    querySnapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });

    readCounter.recordRead('query', 'taskNotifications', 'getUserNotifications', notifications.length);
    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Get unread notifications for a user
 */
export const getUnreadNotifications = async (userId, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskNotifications'),
      where('userId', '==', userId),
      where('organizationID', '==', organizationID),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const notifications = [];

    querySnapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      });
    });

    readCounter.recordRead('query', 'taskNotifications', 'getUnreadNotifications', notifications.length);
    return notifications;
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(firestore, 'taskNotifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskNotifications'),
      where('userId', '==', userId),
      where('organizationID', '==', organizationID),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskNotifications', 'markAllNotificationsAsRead', querySnapshot.size);

    const batch = writeBatch(firestore);
    const now = serverTimestamp();

    querySnapshot.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: now
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(firestore, 'taskNotifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Delete old read notifications (cleanup)
 */
export const deleteOldNotifications = async (userId, organizationID, daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const q = query(
      collection(firestore, 'taskNotifications'),
      where('userId', '==', userId),
      where('organizationID', '==', organizationID),
      where('read', '==', true),
      where('readAt', '<', cutoffDate)
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskNotifications', 'deleteOldNotifications', querySnapshot.size);

    const batch = writeBatch(firestore);

    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting old notifications:', error);
    throw error;
  }
};
