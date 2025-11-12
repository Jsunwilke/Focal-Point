// src/services/taskNotificationHelper.js
import { emailNotificationService } from './emailNotificationService';
import { shouldSendEmailNotification } from './notificationPreferences';
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { secureLogger } from './secureLogger';

/**
 * Task Notification Helper
 * Coordinates email notifications for task-related events with user preferences
 */

/**
 * Get user data by ID
 */
const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(firestore, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    secureLogger.error('Failed to get user data', { userId, error: error.message });
    return null;
  }
};

/**
 * Get multiple users' data
 */
const getUsersData = async (userIds) => {
  const users = await Promise.all(
    userIds.map(userId => getUserData(userId))
  );
  return users.filter(user => user !== null);
};

/**
 * Send task assignment notification
 */
export const notifyTaskAssignment = async (task, assigneeIds, assignerId) => {
  try {
    const [assigner, ...assignees] = await getUsersData([assignerId, ...assigneeIds]);

    if (!assigner) {
      console.warn('Assigner not found, skipping notification');
      return;
    }

    for (const assignee of assignees) {
      // Skip if assigning to self
      if (assignee.id === assignerId) {
        continue;
      }

      // Check if user wants task assignment emails
      const shouldSend = await shouldSendEmailNotification(assignee.id, 'taskAssignment');

      if (shouldSend) {
        await emailNotificationService.notifyTaskAssignment({
          task,
          assignee,
          assigner
        });
      }
    }
  } catch (error) {
    secureLogger.error('Failed to send task assignment notifications', {
      taskId: task.id,
      error: error.message
    });
  }
};

/**
 * Send mention notification
 */
export const notifyMention = async (task, mentionedUserId, mentionerId, comment) => {
  try {
    // Don't notify if mentioning self
    if (mentionedUserId === mentionerId) {
      return;
    }

    // Check if user wants mention emails
    const shouldSend = await shouldSendEmailNotification(mentionedUserId, 'taskMention');

    if (!shouldSend) {
      return;
    }

    const [mentionedUser, mentioner] = await getUsersData([mentionedUserId, mentionerId]);

    if (!mentionedUser || !mentioner) {
      console.warn('User not found, skipping mention notification');
      return;
    }

    await emailNotificationService.notifyMention({
      task,
      mentionedUser,
      mentioner,
      comment
    });
  } catch (error) {
    secureLogger.error('Failed to send mention notification', {
      taskId: task.id,
      error: error.message
    });
  }
};

/**
 * Send comment notification to watchers
 */
export const notifyComment = async (task, commenterId, comment) => {
  try {
    // Get all watchers except the commenter
    const watcherIds = (task.watchers || []).filter(id => id !== commenterId);

    if (watcherIds.length === 0) {
      return;
    }

    // Check preferences for each watcher
    const watchersToNotify = [];
    for (const watcherId of watcherIds) {
      const shouldSend = await shouldSendEmailNotification(watcherId, 'taskComment');
      if (shouldSend) {
        watchersToNotify.push(watcherId);
      }
    }

    if (watchersToNotify.length === 0) {
      return;
    }

    const [commenter, ...recipients] = await getUsersData([commenterId, ...watchersToNotify]);

    if (!commenter || recipients.length === 0) {
      return;
    }

    await emailNotificationService.notifyComment({
      task,
      commenter,
      recipients,
      comment
    });
  } catch (error) {
    secureLogger.error('Failed to send comment notifications', {
      taskId: task.id,
      error: error.message
    });
  }
};

/**
 * Send status change notification
 */
export const notifyStatusChange = async (task, oldStatus, newStatus, changedById) => {
  try {
    // Notify assigned users and watchers (except the person who made the change)
    const assignedIds = task.assignedTo || [];
    const watcherIds = task.watchers || [];
    const allRecipientIds = [...new Set([...assignedIds, ...watcherIds])].filter(id => id !== changedById);

    if (allRecipientIds.length === 0) {
      return;
    }

    // Check preferences for each recipient
    const recipientsToNotify = [];
    for (const recipientId of allRecipientIds) {
      const shouldSend = await shouldSendEmailNotification(recipientId, 'taskStatusChange');
      if (shouldSend) {
        recipientsToNotify.push(recipientId);
      }
    }

    if (recipientsToNotify.length === 0) {
      return;
    }

    const [changedBy, ...recipients] = await getUsersData([changedById, ...recipientsToNotify]);

    if (!changedBy || recipients.length === 0) {
      return;
    }

    for (const recipient of recipients) {
      await emailNotificationService.notifyStatusChange({
        task,
        user: recipient,
        oldStatus,
        newStatus,
        changedBy
      });
    }
  } catch (error) {
    secureLogger.error('Failed to send status change notifications', {
      taskId: task.id,
      error: error.message
    });
  }
};

/**
 * Send due date reminder
 */
export const notifyDueDateReminder = async (task, daysUntilDue) => {
  try {
    const assignedIds = task.assignedTo || [];

    if (assignedIds.length === 0) {
      return;
    }

    // Check preferences for each assigned user
    const usersToNotify = [];
    for (const userId of assignedIds) {
      const shouldSend = await shouldSendEmailNotification(userId, 'dueDateReminders');
      if (shouldSend) {
        usersToNotify.push(userId);
      }
    }

    if (usersToNotify.length === 0) {
      return;
    }

    const users = await getUsersData(usersToNotify);

    for (const user of users) {
      await emailNotificationService.notifyDueDateReminder({
        task,
        user,
        daysUntilDue
      });
    }
  } catch (error) {
    secureLogger.error('Failed to send due date reminders', {
      taskId: task.id,
      error: error.message
    });
  }
};

export default {
  notifyTaskAssignment,
  notifyMention,
  notifyComment,
  notifyStatusChange,
  notifyDueDateReminder
};
