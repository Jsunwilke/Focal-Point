// src/firebase/recurringTasks.js
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';
import { createTask } from './tasks';

/**
 * Create a recurring task configuration
 */
export const createRecurringTask = async (organizationID, userId, recurringData) => {
  try {
    const recurringRef = await addDoc(collection(firestore, 'recurringTasks'), {
      ...recurringData,
      organizationID,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastGenerated: null,
      isActive: true
    });

    readCounter.recordRead('write', 'recurringTasks', 'createRecurringTask', 1);
    return recurringRef.id;
  } catch (error) {
    console.error('Error creating recurring task:', error);
    throw error;
  }
};

/**
 * Get all recurring tasks for an organization
 */
export const getRecurringTasks = async (organizationID) => {
  try {
    const q = query(
      collection(firestore, 'recurringTasks'),
      where('organizationID', '==', organizationID),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'recurringTasks', 'getRecurringTasks', snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting recurring tasks:', error);
    throw error;
  }
};

/**
 * Update a recurring task
 */
export const updateRecurringTask = async (recurringId, updates) => {
  try {
    const recurringRef = doc(firestore, 'recurringTasks', recurringId);
    await updateDoc(recurringRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });

    readCounter.recordRead('write', 'recurringTasks', 'updateRecurringTask', 1);
  } catch (error) {
    console.error('Error updating recurring task:', error);
    throw error;
  }
};

/**
 * Delete (deactivate) a recurring task
 */
export const deleteRecurringTask = async (recurringId) => {
  try {
    const recurringRef = doc(firestore, 'recurringTasks', recurringId);
    await updateDoc(recurringRef, {
      isActive: false,
      updatedAt: Timestamp.now()
    });

    readCounter.recordRead('write', 'recurringTasks', 'deleteRecurringTask', 1);
  } catch (error) {
    console.error('Error deleting recurring task:', error);
    throw error;
  }
};

/**
 * Calculate next occurrence date
 */
export const calculateNextOccurrence = (lastDate, frequency, interval = 1) => {
  const next = new Date(lastDate);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      break;
  }

  return next;
};

/**
 * Check and generate recurring tasks that are due
 */
export const processRecurringTasks = async (organizationID) => {
  try {
    const recurringTasks = await getRecurringTasks(organizationID);
    const now = new Date();
    const generatedTasks = [];

    for (const recurring of recurringTasks) {
      const lastGenerated = recurring.lastGenerated?.toDate() || recurring.createdAt.toDate();
      const nextOccurrence = calculateNextOccurrence(
        lastGenerated,
        recurring.frequency,
        recurring.interval || 1
      );

      // If it's time to generate the next occurrence
      if (nextOccurrence <= now) {
        // Calculate due date relative to generated date
        let dueDate = null;
        if (recurring.daysUntilDue) {
          dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + recurring.daysUntilDue);
        }

        // Create the new task
        const taskData = {
          title: recurring.title,
          description: recurring.description || '',
          priority: recurring.priority || 'medium',
          type: recurring.type || 'general',
          status: 'todo',
          assignedTo: recurring.assignedTo || null,
          dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
          tags: recurring.tags || [],
          subtasks: recurring.subtasks || [],
          checklist: recurring.checklist || [],
          recurringTaskId: recurring.id,
          organizationID,
          createdBy: recurring.createdBy
        };

        const newTaskId = await createTask(taskData);
        generatedTasks.push(newTaskId);

        // Update the recurring task's lastGenerated timestamp
        await updateRecurringTask(recurring.id, {
          lastGenerated: Timestamp.now()
        });
      }
    }

    return generatedTasks;
  } catch (error) {
    console.error('Error processing recurring tasks:', error);
    throw error;
  }
};

/**
 * Get recurrence description in human-readable format
 */
export const getRecurrenceDescription = (frequency, interval = 1) => {
  if (interval === 1) {
    switch (frequency) {
      case 'daily':
        return 'Every day';
      case 'weekly':
        return 'Every week';
      case 'monthly':
        return 'Every month';
      case 'yearly':
        return 'Every year';
      default:
        return 'Unknown frequency';
    }
  } else {
    switch (frequency) {
      case 'daily':
        return `Every ${interval} days`;
      case 'weekly':
        return `Every ${interval} weeks`;
      case 'monthly':
        return `Every ${interval} months`;
      case 'yearly':
        return `Every ${interval} years`;
      default:
        return 'Unknown frequency';
    }
  }
};
