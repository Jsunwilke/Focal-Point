// src/services/notificationPreferences.js
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { secureLogger } from './secureLogger';

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  email: {
    enabled: true,
    taskAssignment: true,
    taskMention: true,
    taskComment: true,
    taskStatusChange: false,
    dueDateReminders: true,
    dueDateReminderDays: [1, 3], // Days before due date to send reminders
  },
  inApp: {
    enabled: true,
    taskAssignment: true,
    taskMention: true,
    taskComment: true,
    taskStatusChange: true,
    dueDateReminders: true,
  }
};

/**
 * Get user's notification preferences
 */
export const getUserNotificationPreferences = async (userId) => {
  try {
    const userDoc = await getDoc(doc(firestore, 'users', userId));

    if (!userDoc.exists()) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const userData = userDoc.data();
    const preferences = userData.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;

    // Merge with defaults to ensure all fields exist
    return {
      email: { ...DEFAULT_NOTIFICATION_PREFERENCES.email, ...preferences.email },
      inApp: { ...DEFAULT_NOTIFICATION_PREFERENCES.inApp, ...preferences.inApp }
    };
  } catch (error) {
    secureLogger.error('Failed to get notification preferences', {
      userId,
      error: error.message
    });
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

/**
 * Update user's notification preferences
 */
export const updateUserNotificationPreferences = async (userId, preferences) => {
  try {
    const userRef = doc(firestore, 'users', userId);

    await updateDoc(userRef, {
      notificationPreferences: preferences,
      updatedAt: new Date()
    });

    secureLogger.info('Updated notification preferences', { userId });
    return { success: true };
  } catch (error) {
    secureLogger.error('Failed to update notification preferences', {
      userId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

/**
 * Check if user should receive a specific email notification
 */
export const shouldSendEmailNotification = async (userId, notificationType) => {
  const preferences = await getUserNotificationPreferences(userId);

  if (!preferences.email.enabled) {
    return false;
  }

  return preferences.email[notificationType] === true;
};

/**
 * Check if user should receive a specific in-app notification
 */
export const shouldSendInAppNotification = async (userId, notificationType) => {
  const preferences = await getUserNotificationPreferences(userId);

  if (!preferences.inApp.enabled) {
    return false;
  }

  return preferences.inApp[notificationType] === true;
};

/**
 * Initialize notification preferences for a new user
 */
export const initializeUserNotificationPreferences = async (userId) => {
  try {
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);

    // Only initialize if preferences don't exist
    if (!userDoc.exists() || !userDoc.data().notificationPreferences) {
      await setDoc(userRef, {
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        updatedAt: new Date()
      }, { merge: true });

      secureLogger.info('Initialized notification preferences', { userId });
    }

    return { success: true };
  } catch (error) {
    secureLogger.error('Failed to initialize notification preferences', {
      userId,
      error: error.message
    });
    return { success: false, error: error.message };
  }
};

export default {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  shouldSendEmailNotification,
  shouldSendInAppNotification,
  initializeUserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES
};
