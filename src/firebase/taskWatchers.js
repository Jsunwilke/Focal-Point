// src/firebase/taskWatchers.js
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';
import { logActivity, ACTIVITY_TYPES } from './activity';
import secureLogger from '../utils/secureLogger';

/**
 * Add a watcher to a task
 * @param {string} taskId - The task ID
 * @param {string} userId - The user ID to add as watcher
 * @param {string} organizationId - The organization ID
 * @returns {Promise<void>}
 */
export const watchTask = async (taskId, userId, organizationId) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);

    // Update task with new watcher
    await updateDoc(taskRef, {
      watchers: arrayUnion(userId),
      updatedAt: new Date()
    });

    // Log activity
    await logActivity(
      taskId,
      ACTIVITY_TYPES.WATCHER_ADDED,
      { watcherId: userId },
      userId,
      organizationId
    );

    secureLogger.info('User added as watcher', { taskId, userId });
  } catch (error) {
    secureLogger.error('Error adding watcher', { taskId, userId, error: error.message });
    throw error;
  }
};

/**
 * Remove a watcher from a task
 * @param {string} taskId - The task ID
 * @param {string} userId - The user ID to remove as watcher
 * @param {string} organizationId - The organization ID
 * @returns {Promise<void>}
 */
export const unwatchTask = async (taskId, userId, organizationId) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);

    // Update task to remove watcher
    await updateDoc(taskRef, {
      watchers: arrayRemove(userId),
      updatedAt: new Date()
    });

    // Log activity
    await logActivity(
      taskId,
      ACTIVITY_TYPES.WATCHER_REMOVED,
      { watcherId: userId },
      userId,
      organizationId
    );

    secureLogger.info('User removed as watcher', { taskId, userId });
  } catch (error) {
    secureLogger.error('Error removing watcher', { taskId, userId, error: error.message });
    throw error;
  }
};

/**
 * Check if a user is watching a task
 * @param {string} taskId - The task ID
 * @param {string} userId - The user ID to check
 * @returns {Promise<boolean>}
 */
export const isWatchingTask = async (taskId, userId) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);

    readCounter.recordRead('get', 'tasks', 'isWatchingTask', 1);

    if (!taskSnap.exists()) {
      return false;
    }

    const task = taskSnap.data();
    return task.watchers?.includes(userId) || false;
  } catch (error) {
    secureLogger.error('Error checking watcher status', { taskId, userId, error: error.message });
    throw error;
  }
};

/**
 * Auto-watch a task when user performs certain actions
 * @param {string} taskId - The task ID
 * @param {string} userId - The user ID
 * @param {string} organizationId - The organization ID
 * @param {string} reason - Reason for auto-watching (commented, mentioned, etc.)
 * @returns {Promise<void>}
 */
export const autoWatchTask = async (taskId, userId, organizationId, reason = 'activity') => {
  try {
    // Check if already watching
    const isWatching = await isWatchingTask(taskId, userId);
    if (isWatching) {
      return; // Already watching, no need to add again
    }

    // Add as watcher without logging activity (auto-watch is silent)
    const taskRef = doc(firestore, 'tasks', taskId);
    await updateDoc(taskRef, {
      watchers: arrayUnion(userId),
      updatedAt: new Date()
    });

    secureLogger.info('User auto-added as watcher', { taskId, userId, reason });
  } catch (error) {
    // Don't throw error for auto-watch failures, just log
    secureLogger.warn('Error auto-watching task', { taskId, userId, reason, error: error.message });
  }
};

export default {
  watchTask,
  unwatchTask,
  isWatchingTask,
  autoWatchTask
};
