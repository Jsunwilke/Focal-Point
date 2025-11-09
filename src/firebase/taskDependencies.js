// src/firebase/taskDependencies.js
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './config';
import { readCounter } from '../services/readCounter';

/**
 * Add a dependency relationship between tasks
 * @param {string} taskId - The task that is blocked
 * @param {string} dependsOnTaskId - The task that must be completed first
 * @param {string} organizationID - Organization ID
 */
export const addTaskDependency = async (taskId, dependsOnTaskId, organizationID) => {
  try {
    // Check for circular dependencies first
    const hasCircular = await checkCircularDependency(taskId, dependsOnTaskId, organizationID);
    if (hasCircular) {
      throw new Error('Circular dependency detected. This would create an infinite loop.');
    }

    // Check if dependency already exists
    const existing = await getDependency(taskId, dependsOnTaskId, organizationID);
    if (existing) {
      throw new Error('This dependency already exists.');
    }

    const dependencyRef = await addDoc(collection(firestore, 'taskDependencies'), {
      taskId,
      dependsOnTaskId,
      organizationID,
      createdAt: Timestamp.now()
    });

    readCounter.recordRead('write', 'taskDependencies', 'addTaskDependency', 1);
    return dependencyRef.id;
  } catch (error) {
    console.error('Error adding task dependency:', error);
    throw error;
  }
};

/**
 * Get dependency by task IDs
 */
const getDependency = async (taskId, dependsOnTaskId, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskDependencies'),
      where('taskId', '==', taskId),
      where('dependsOnTaskId', '==', dependsOnTaskId),
      where('organizationID', '==', organizationID)
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskDependencies', 'getDependency', snapshot.size);

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getting dependency:', error);
    return null;
  }
};

/**
 * Check for circular dependencies
 */
const checkCircularDependency = async (taskId, dependsOnTaskId, organizationID, visited = new Set()) => {
  // If we've already checked this task, skip it
  if (visited.has(dependsOnTaskId)) {
    return false;
  }

  // If the dependency points back to the original task, it's circular
  if (dependsOnTaskId === taskId) {
    return true;
  }

  visited.add(dependsOnTaskId);

  // Get all tasks that dependsOnTaskId depends on
  const dependencies = await getTaskDependencies(dependsOnTaskId, organizationID);

  // Recursively check each dependency
  for (const dep of dependencies) {
    const isCircular = await checkCircularDependency(taskId, dep.dependsOnTaskId, organizationID, visited);
    if (isCircular) {
      return true;
    }
  }

  return false;
};

/**
 * Get all dependencies for a task (tasks this task depends on)
 */
export const getTaskDependencies = async (taskId, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskDependencies'),
      where('taskId', '==', taskId),
      where('organizationID', '==', organizationID)
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskDependencies', 'getTaskDependencies', snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting task dependencies:', error);
    throw error;
  }
};

/**
 * Get all dependents for a task (tasks that depend on this task)
 */
export const getTaskDependents = async (taskId, organizationID) => {
  try {
    const q = query(
      collection(firestore, 'taskDependencies'),
      where('dependsOnTaskId', '==', taskId),
      where('organizationID', '==', organizationID)
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'taskDependencies', 'getTaskDependents', snapshot.size);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting task dependents:', error);
    throw error;
  }
};

/**
 * Remove a dependency
 */
export const removeTaskDependency = async (dependencyId) => {
  try {
    const dependencyRef = doc(firestore, 'taskDependencies', dependencyId);
    await deleteDoc(dependencyRef);

    readCounter.recordRead('write', 'taskDependencies', 'removeTaskDependency', 1);
  } catch (error) {
    console.error('Error removing task dependency:', error);
    throw error;
  }
};

/**
 * Check if a task can be started (all dependencies completed)
 */
export const canStartTask = async (taskId, organizationID, allTasks) => {
  try {
    const dependencies = await getTaskDependencies(taskId, organizationID);

    if (dependencies.length === 0) {
      return { canStart: true, blockedBy: [] };
    }

    const blockedBy = [];

    for (const dep of dependencies) {
      const blockingTask = allTasks.find(t => t.id === dep.dependsOnTaskId);
      if (blockingTask && blockingTask.status !== 'completed') {
        blockedBy.push({
          id: blockingTask.id,
          title: blockingTask.title,
          status: blockingTask.status
        });
      }
    }

    return {
      canStart: blockedBy.length === 0,
      blockedBy
    };
  } catch (error) {
    console.error('Error checking if task can start:', error);
    return { canStart: true, blockedBy: [] };
  }
};
