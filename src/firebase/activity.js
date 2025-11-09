// src/firebase/activity.js
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';

/**
 * Activity types for task tracking
 */
export const ACTIVITY_TYPES = {
  TASK_CREATED: 'task_created',
  STATUS_CHANGED: 'status_changed',
  ASSIGNEE_ADDED: 'assignee_added',
  ASSIGNEE_REMOVED: 'assignee_removed',
  DUE_DATE_CHANGED: 'due_date_changed',
  PRIORITY_CHANGED: 'priority_changed',
  DESCRIPTION_UPDATED: 'description_updated',
  TITLE_UPDATED: 'title_updated',
  SUBTASK_ADDED: 'subtask_added',
  SUBTASK_COMPLETED: 'subtask_completed',
  SUBTASK_UNCOMPLETED: 'subtask_uncompleted',
  COMMENT_ADDED: 'comment_added',
  TASK_COMPLETED: 'task_completed',
  TASK_REOPENED: 'task_reopened',
  ATTACHMENT_UPLOADED: 'attachment_uploaded',
  ATTACHMENT_DELETED: 'attachment_deleted',
  TIME_LOGGED: 'time_logged',
  WATCHER_ADDED: 'watcher_added',
  WATCHER_REMOVED: 'watcher_removed'
};

/**
 * Log an activity event for a task
 * @param {string} taskId - The task ID
 * @param {string} activityType - Type of activity from ACTIVITY_TYPES
 * @param {object} data - Additional activity data
 * @param {string} userId - User ID who performed the action
 * @param {string} organizationID - Organization ID
 * @returns {Promise<string>} - Activity document ID
 */
export const logActivity = async (taskId, activityType, data, userId, organizationID) => {
  try {
    const activityData = {
      taskId,
      type: activityType,
      data: data || {},
      userId,
      organizationID,
      timestamp: Timestamp.now()
    };

    const docRef = await addDoc(collection(firestore, 'taskActivities'), activityData);
    // Note: readCounter only tracks reads, not writes

    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

/**
 * Get all activities for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Array>} - Array of activity objects
 */
export const getTaskActivities = async (taskId) => {
  try {
    const q = query(
      collection(firestore, 'taskActivities'),
      where('taskId', '==', taskId),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskActivities', 'ActivityService', snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting task activities:', error);
    throw error;
  }
};

/**
 * Subscribe to task activities with real-time updates
 * @param {string} taskId - The task ID
 * @param {function} callback - Callback function to receive activities
 * @param {Timestamp} lastTimestamp - Last activity timestamp for incremental updates
 * @returns {function} - Unsubscribe function
 */
export const subscribeToTaskActivities = (taskId, callback, lastTimestamp = null) => {
  try {
    let q;

    if (lastTimestamp) {
      // Convert to proper Firestore Timestamp if needed
      let firestoreTimestamp = lastTimestamp;

      // Check if it's a deserialized timestamp (plain object with seconds/nanoseconds)
      // Real Firestore Timestamps are instances of the Timestamp class
      const isRealTimestamp = lastTimestamp instanceof Timestamp;

      if (!isRealTimestamp && lastTimestamp.seconds !== undefined) {
        // It's a deserialized timestamp object, convert to Firestore Timestamp
        firestoreTimestamp = new Timestamp(lastTimestamp.seconds, lastTimestamp.nanoseconds || 0);
      } else if (!isRealTimestamp && typeof lastTimestamp.toMillis === 'function') {
        // It's a timestamp-like object with toMillis
        const millis = lastTimestamp.toMillis();
        firestoreTimestamp = Timestamp.fromMillis(millis);
      }

      // Optimized listener: only fetch new activities
      q = query(
        collection(firestore, 'taskActivities'),
        where('taskId', '==', taskId),
        where('timestamp', '>', firestoreTimestamp),
        orderBy('timestamp', 'desc')
      );
    } else {
      // Initial load: fetch all activities
      q = query(
        collection(firestore, 'taskActivities'),
        where('taskId', '==', taskId),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      readCounter.recordRead('snapshot', 'taskActivities', 'ActivityService', snapshot.size);

      callback(activities, !!lastTimestamp);
    }, (error) => {
      console.error('Error in activity subscription:', error);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to activities:', error);
    throw error;
  }
};

/**
 * Format activity data for human-readable display
 * @param {object} activity - Activity object
 * @param {object} userMap - Map of user IDs to user objects
 * @returns {string} - Formatted activity description
 */
export const formatActivityDescription = (activity, userMap = {}) => {
  const user = userMap[activity.userId];
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Someone';

  switch (activity.type) {
    case ACTIVITY_TYPES.TASK_CREATED:
      return `${userName} created this task`;

    case ACTIVITY_TYPES.STATUS_CHANGED:
      return `${userName} changed status from ${activity.data.oldStatus} to ${activity.data.newStatus}`;

    case ACTIVITY_TYPES.ASSIGNEE_ADDED:
      const addedUser = userMap[activity.data.assigneeId];
      const addedUserName = addedUser ? `${addedUser.firstName} ${addedUser.lastName}` : 'a user';
      return `${userName} assigned ${addedUserName}`;

    case ACTIVITY_TYPES.ASSIGNEE_REMOVED:
      const removedUser = userMap[activity.data.assigneeId];
      const removedUserName = removedUser ? `${removedUser.firstName} ${removedUser.lastName}` : 'a user';
      return `${userName} unassigned ${removedUserName}`;

    case ACTIVITY_TYPES.DUE_DATE_CHANGED:
      if (activity.data.oldDueDate && activity.data.newDueDate) {
        return `${userName} changed due date`;
      } else if (activity.data.newDueDate) {
        return `${userName} set a due date`;
      } else {
        return `${userName} removed the due date`;
      }

    case ACTIVITY_TYPES.PRIORITY_CHANGED:
      return `${userName} changed priority from ${activity.data.oldPriority} to ${activity.data.newPriority}`;

    case ACTIVITY_TYPES.DESCRIPTION_UPDATED:
      return `${userName} updated the description`;

    case ACTIVITY_TYPES.TITLE_UPDATED:
      return `${userName} updated the title`;

    case ACTIVITY_TYPES.SUBTASK_ADDED:
      return `${userName} added subtask: "${activity.data.subtaskTitle}"`;

    case ACTIVITY_TYPES.SUBTASK_COMPLETED:
      return `${userName} completed subtask: "${activity.data.subtaskTitle}"`;

    case ACTIVITY_TYPES.SUBTASK_UNCOMPLETED:
      return `${userName} reopened subtask: "${activity.data.subtaskTitle}"`;

    case ACTIVITY_TYPES.COMMENT_ADDED:
      return `${userName} added a comment`;

    case ACTIVITY_TYPES.TASK_COMPLETED:
      return `${userName} marked this task as complete`;

    case ACTIVITY_TYPES.TASK_REOPENED:
      return `${userName} reopened this task`;

    case ACTIVITY_TYPES.ATTACHMENT_UPLOADED:
      return `${userName} uploaded ${activity.data.fileName || 'an attachment'}`;

    case ACTIVITY_TYPES.ATTACHMENT_DELETED:
      return `${userName} deleted ${activity.data.fileName || 'an attachment'}`;

    case ACTIVITY_TYPES.TIME_LOGGED:
      const duration = activity.data.duration || 0;
      const hours = Math.floor(duration);
      const minutes = Math.round((duration - hours) * 60);
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      return `${userName} logged ${timeStr} of time`;

    case ACTIVITY_TYPES.WATCHER_ADDED:
      const watcherAdded = userMap[activity.data.watcherId];
      const watcherAddedName = watcherAdded ? `${watcherAdded.firstName} ${watcherAdded.lastName}` : 'a user';
      if (activity.userId === activity.data.watcherId) {
        return `${userName} started watching this task`;
      }
      return `${userName} added ${watcherAddedName} as a watcher`;

    case ACTIVITY_TYPES.WATCHER_REMOVED:
      const watcherRemoved = userMap[activity.data.watcherId];
      const watcherRemovedName = watcherRemoved ? `${watcherRemoved.firstName} ${watcherRemoved.lastName}` : 'a user';
      if (activity.userId === activity.data.watcherId) {
        return `${userName} stopped watching this task`;
      }
      return `${userName} removed ${watcherRemovedName} as a watcher`;

    default:
      return `${userName} performed an action`;
  }
};
