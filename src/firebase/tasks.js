// src/firebase/tasks.js - Firebase helper functions for task management

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  firestore
} from "../services/firestoreWrapper";
import secureLogger from '../utils/secureLogger';
import { readCounter } from '../services/readCounter';
import taskCacheService from '../services/taskCacheService';
import taskCommentsCacheService from '../services/taskCommentsCacheService';

// Create a new task
export const createTask = async (taskData) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    const status = taskData.status || 'todo';

    // Get max order for this status in the organization to calculate new order
    let maxOrder = -1;
    try {
      const statusQuery = query(
        tasksRef,
        where('organizationID', '==', taskData.organizationID),
        where('status', '==', status),
        orderBy('order', 'desc')
      );
      const snapshot = await getDocs(statusQuery);
      readCounter.recordRead('query', 'tasks', 'createTask_getMaxOrder', snapshot.size);

      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        maxOrder = firstDoc.data().order ?? -1;
      }
    } catch (queryError) {
      // If order field doesn't exist yet or query fails, start from 0
      secureLogger.debug('Could not query max order, starting from 0', { error: queryError.message });
    }

    const newTask = {
      ...taskData,
      status,
      priority: taskData.priority || 'medium',
      subtasks: taskData.subtasks || [],
      commentCount: 0,
      timeEntryIds: [],
      order: maxOrder + 1, // Add order field
      // Workflow linkage fields
      workflowId: taskData.workflowId || null,
      workflowStepId: taskData.workflowStepId || null,
      autoCreated: taskData.autoCreated || false,
      syncWithWorkflow: taskData.syncWithWorkflow || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(tasksRef, newTask);
    secureLogger.debug('Task created successfully', { taskId: docRef.id, order: newTask.order });

    // Clear cache to force refresh
    taskCacheService.clearOrganizationCache(taskData.organizationID);

    return { id: docRef.id, ...newTask };
  } catch (error) {
    secureLogger.error('Error creating task', { error: error.message });
    readCounter.recordError('tasks', 'createTask', error.message);
    throw error;
  }
};

// Update a task
export const updateTask = async (taskId, updates) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(taskRef, updateData);
    readCounter.recordRead('updateDoc', 'tasks', 'updateTask', 1);
    secureLogger.debug('Task updated successfully', { taskId });

    // Update single task cache
    const taskDoc = await getDoc(taskRef);
    if (taskDoc.exists()) {
      const taskData = { id: taskDoc.id, ...taskDoc.data() };
      taskCacheService.setCachedTask(taskId, taskData);

      // Sync to workflow step if task is completed and has workflow linkage
      if (updates.status === 'completed' && taskData.syncWithWorkflow && taskData.workflowId && taskData.workflowStepId) {
        try {
          const { syncTaskToWorkflowStep } = await import('../services/workflowTaskService');
          // Get the user who completed the task - use current auth user or updatedBy field
          const userId = updates.completedBy || updates.updatedBy || taskData.createdBy;
          await syncTaskToWorkflowStep(taskId, taskData, userId);
        } catch (syncError) {
          // Don't fail the task update if sync fails
          secureLogger.error('Error syncing task to workflow', { taskId, error: syncError.message });
        }
      }
    }

    return true;
  } catch (error) {
    secureLogger.error('Error updating task', { taskId, error: error.message });
    readCounter.recordError('tasks', 'updateTask', error.message);
    throw error;
  }
};

// Delete a task
export const deleteTask = async (taskId, organizationID) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);

    // Get task data before deletion to check for workflow linkage
    const taskDoc = await getDoc(taskRef);
    readCounter.recordRead('get', 'tasks', 'deleteTask', 1);

    if (!taskDoc.exists()) {
      secureLogger.warn('Task not found for deletion', { taskId });
      return false;
    }

    const taskData = taskDoc.data();

    // Handle workflow sync before deletion
    if (taskData.syncWithWorkflow && taskData.workflowId && taskData.workflowStepId) {
      try {
        const { handleTaskDeletion } = await import('../services/workflowTaskService');
        await handleTaskDeletion({ id: taskId, ...taskData });
      } catch (syncError) {
        // Log but don't fail the deletion
        secureLogger.error('Error handling workflow sync on task deletion', {
          taskId,
          error: syncError.message
        });
      }
    }

    await deleteDoc(taskRef);

    secureLogger.debug('Task deleted successfully', { taskId });

    // Clear cache
    taskCacheService.clearOrganizationCache(organizationID);
    taskCommentsCacheService.clearTaskComments(taskId);

    return true;
  } catch (error) {
    secureLogger.error('Error deleting task', { taskId, error: error.message });
    readCounter.recordError('tasks', 'deleteTask', error.message);
    throw error;
  }
};

// Get tasks for a specific user
export const getUserTasks = async (userId, organizationID, statusFilter = null) => {
  try {
    const tasksRef = collection(firestore, 'tasks');

    // Firestore doesn't support OR queries with different fields, so we need two separate queries
    // Query 1: Tasks assigned to user
    let assignedQuery = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('assignedTo', 'array-contains', userId),
      orderBy('dueDate', 'asc')
    );

    // Query 2: Tasks created by user
    let createdQuery = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('createdBy', '==', userId),
      orderBy('dueDate', 'asc')
    );

    if (statusFilter) {
      assignedQuery = query(assignedQuery, where('status', '==', statusFilter));
      createdQuery = query(createdQuery, where('status', '==', statusFilter));
    }

    const [assignedSnapshot, createdSnapshot] = await Promise.all([
      getDocs(assignedQuery),
      getDocs(createdQuery)
    ]);

    readCounter.recordRead('getDocs', 'tasks', 'getUserTasks', assignedSnapshot.size + createdSnapshot.size);

    // Combine results and deduplicate (a task can be both created by and assigned to the user)
    const taskMap = new Map();

    assignedSnapshot.docs.forEach(doc => {
      taskMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    createdSnapshot.docs.forEach(doc => {
      if (!taskMap.has(doc.id)) {
        taskMap.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });

    const tasks = Array.from(taskMap.values());

    // Sort by due date
    tasks.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        const aTime = a.dueDate.toMillis ? a.dueDate.toMillis() : new Date(a.dueDate).getTime();
        const bTime = b.dueDate.toMillis ? b.dueDate.toMillis() : new Date(b.dueDate).getTime();
        return aTime - bTime;
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }
      return 0;
    });

    secureLogger.debug('User tasks fetched', { userId, count: tasks.length });
    return tasks;
  } catch (error) {
    secureLogger.error('Error fetching user tasks', { userId, error: error.message });
    readCounter.recordError('tasks', 'getUserTasks', error.message);
    throw error;
  }
};

// Get all tasks for an organization (team tasks - for managers/admins)
export const getOrganizationTasks = async (organizationID, statusFilter = null) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    let q = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      orderBy('dueDate', 'asc')
    );

    if (statusFilter) {
      q = query(q, where('status', '==', statusFilter));
    }

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'tasks', 'getOrganizationTasks', querySnapshot.size);

    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    secureLogger.debug('Organization tasks fetched', { organizationID, count: tasks.length });
    return tasks;
  } catch (error) {
    secureLogger.error('Error fetching organization tasks', { organizationID, error: error.message });
    readCounter.recordError('tasks', 'getOrganizationTasks', error.message);
    throw error;
  }
};

// Get tasks for a specific session
export const getSessionTasks = async (sessionId, organizationID) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    const q = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('sessionId', '==', sessionId),
      orderBy('dueDate', 'asc')
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'tasks', 'getSessionTasks', querySnapshot.size);

    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    secureLogger.debug('Session tasks fetched', { sessionId, count: tasks.length });
    return tasks;
  } catch (error) {
    secureLogger.error('Error fetching session tasks', { sessionId, error: error.message });
    readCounter.recordError('tasks', 'getSessionTasks', error.message);
    throw error;
  }
};

// Get tasks for a specific workflow
export const getWorkflowTasks = async (workflowID, organizationID) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    const q = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('workflowID', '==', workflowID),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'tasks', 'getWorkflowTasks', querySnapshot.size);

    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    secureLogger.debug('Workflow tasks fetched', { workflowID, count: tasks.length });
    return tasks;
  } catch (error) {
    secureLogger.error('Error fetching workflow tasks', { workflowID, error: error.message });
    readCounter.recordError('tasks', 'getWorkflowTasks', error.message);
    throw error;
  }
};

// Get tasks for a specific workflow step
export const getWorkflowStepTasks = async (workflowID, workflowStepID, organizationID) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    const q = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('workflowID', '==', workflowID),
      where('workflowStepID', '==', workflowStepID),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'tasks', 'getWorkflowStepTasks', querySnapshot.size);

    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    secureLogger.debug('Workflow step tasks fetched', { workflowID, workflowStepID, count: tasks.length });
    return tasks;
  } catch (error) {
    secureLogger.error('Error fetching workflow step tasks', { workflowID, workflowStepID, error: error.message });
    readCounter.recordError('tasks', 'getWorkflowStepTasks', error.message);
    throw error;
  }
};

// Get tasks for multiple workflow steps (batch query for matrix view)
export const getWorkflowStepTasksBatch = async (workflowStepPairs, organizationID) => {
  try {
    // workflowStepPairs is an array of { workflowID, workflowStepID }
    // Due to Firestore limitations, we need to query each pair separately
    const tasksByStep = {};

    const promises = workflowStepPairs.map(async ({ workflowID, workflowStepID }) => {
      const key = `${workflowID}_${workflowStepID}`;
      const tasks = await getWorkflowStepTasks(workflowID, workflowStepID, organizationID);
      tasksByStep[key] = tasks;
    });

    await Promise.all(promises);

    return tasksByStep;
  } catch (error) {
    secureLogger.error('Error fetching workflow step tasks batch', { error: error.message });
    readCounter.recordError('tasks', 'getWorkflowStepTasksBatch', error.message);
    throw error;
  }
};

// Subscribe to user tasks with optimized listener
export const subscribeToUserTasks = (userId, organizationID, callback, lastTimestamp = null) => {
  try {
    const tasksRef = collection(firestore, 'tasks');

    // Query 1: Tasks assigned to user
    let assignedQuery = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('assignedTo', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    // Query 2: Tasks created by user
    let createdQuery = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      where('createdBy', '==', userId),
      orderBy('updatedAt', 'desc')
    );

    // Only fetch tasks updated after the last cached timestamp
    if (lastTimestamp) {
      assignedQuery = query(assignedQuery, where('updatedAt', '>', lastTimestamp));
      createdQuery = query(createdQuery, where('updatedAt', '>', lastTimestamp));
    }

    const assignedListenerId = readCounter.recordListener('tasks', 'subscribeToUserTasks-assigned', 0);
    const createdListenerId = readCounter.recordListener('tasks', 'subscribeToUserTasks-created', 0);

    // Map to store combined results and avoid duplicates
    const taskMap = new Map();

    const mergeAndCallback = () => {
      const tasks = Array.from(taskMap.values());
      // Sort by updatedAt desc
      tasks.sort((a, b) => {
        const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
        const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
        return bTime - aTime;
      });
      callback(tasks, !!lastTimestamp);
    };

    // Listener for assigned tasks
    const unsubscribeAssigned = onSnapshot(assignedQuery, (snapshot) => {
      readCounter.recordListenerUpdate(assignedListenerId, 'tasks', 'subscribeToUserTasks-assigned', snapshot.size);

      // Handle document changes (added, modified, removed)
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          taskMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          taskMap.delete(change.doc.id);
        }
      });

      mergeAndCallback();
    }, (error) => {
      secureLogger.error('Error in assigned tasks listener', { userId, error: error.message });
      readCounter.recordError('tasks', 'subscribeToUserTasks-assigned', error.message);
    });

    // Listener for created tasks
    const unsubscribeCreated = onSnapshot(createdQuery, (snapshot) => {
      readCounter.recordListenerUpdate(createdListenerId, 'tasks', 'subscribeToUserTasks-created', snapshot.size);

      // Handle document changes (added, modified, removed)
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          taskMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          taskMap.delete(change.doc.id);
        }
      });

      mergeAndCallback();
    }, (error) => {
      secureLogger.error('Error in created tasks listener', { userId, error: error.message });
      readCounter.recordError('tasks', 'subscribeToUserTasks-created', error.message);
    });

    // Return combined unsubscribe function
    return () => {
      readCounter.removeListener(assignedListenerId);
      readCounter.removeListener(createdListenerId);
      unsubscribeAssigned();
      unsubscribeCreated();
    };
  } catch (error) {
    secureLogger.error('Error setting up user tasks listener', { userId, error: error.message });
    readCounter.recordError('tasks', 'subscribeToUserTasks', error.message);
    throw error;
  }
};

// Subscribe to organization tasks (for managers/admins)
export const subscribeToOrganizationTasks = (organizationID, callback, lastTimestamp = null) => {
  try {
    const tasksRef = collection(firestore, 'tasks');
    let q = query(
      tasksRef,
      where('organizationID', '==', organizationID),
      orderBy('updatedAt', 'desc')
    );

    // Only fetch tasks updated after the last cached timestamp
    if (lastTimestamp) {
      q = query(q, where('updatedAt', '>', lastTimestamp));
    }

    const listenerId = readCounter.recordListener('tasks', 'subscribeToOrganizationTasks', 0);

    // Task map to track all organization tasks
    const taskMap = new Map();

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const isIncremental = !!lastTimestamp;

      // Track the actual read count
      readCounter.recordListenerUpdate(listenerId, 'tasks', 'subscribeToOrganizationTasks', snapshot.size);

      // Handle document changes (added, modified, removed)
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          taskMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          taskMap.delete(change.doc.id);
        }
      });

      // Convert map to array
      const tasks = Array.from(taskMap.values());

      callback(tasks, isIncremental);
    }, (error) => {
      secureLogger.error('Error in organization tasks listener', { organizationID, error: error.message });
      readCounter.recordError('tasks', 'subscribeToOrganizationTasks', error.message);
    });

    return () => {
      readCounter.removeListener(listenerId);
      unsubscribe();
    };
  } catch (error) {
    secureLogger.error('Error setting up organization tasks listener', { organizationID, error: error.message });
    readCounter.recordError('tasks', 'subscribeToOrganizationTasks', error.message);
    throw error;
  }
};

// Add a comment to a task
export const addTaskComment = async (taskId, commentData) => {
  try {
    const commentsRef = collection(firestore, 'tasks', taskId, 'comments');

    const newComment = {
      ...commentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(commentsRef, newComment);

    // Increment comment count on task
    const taskRef = doc(firestore, 'tasks', taskId);
    await updateDoc(taskRef, {
      commentCount: arrayUnion(docRef.id).length,
      updatedAt: serverTimestamp()
    });

    secureLogger.debug('Comment added to task', { taskId, commentId: docRef.id });

    // Add comment to cache
    const commentWithId = { id: docRef.id, ...newComment };
    taskCommentsCacheService.addCommentToCache(taskId, commentWithId);

    return commentWithId;
  } catch (error) {
    secureLogger.error('Error adding comment to task', { taskId, error: error.message });
    readCounter.recordError('taskComments', 'addTaskComment', error.message);
    throw error;
  }
};

// Get comments for a task
export const getTaskComments = async (taskId) => {
  try {
    const commentsRef = collection(firestore, 'tasks', taskId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'desc'));

    const querySnapshot = await getDocs(q);
    readCounter.recordRead('getDocs', 'taskComments', 'getTaskComments', querySnapshot.size);

    const comments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    secureLogger.debug('Task comments fetched', { taskId, count: comments.length });
    return comments;
  } catch (error) {
    secureLogger.error('Error fetching task comments', { taskId, error: error.message });
    readCounter.recordError('taskComments', 'getTaskComments', error.message);
    throw error;
  }
};

// Subscribe to task comments with optimized listener
export const subscribeToTaskComments = (taskId, callback, lastTimestamp = null) => {
  try {
    const commentsRef = collection(firestore, 'tasks', taskId, 'comments');
    let q = query(commentsRef, orderBy('createdAt', 'desc'));

    // Only fetch comments created after the last cached timestamp
    if (lastTimestamp) {
      q = query(q, where('createdAt', '>', lastTimestamp));
    }

    const listenerId = readCounter.recordListener('taskComments', 'subscribeToTaskComments', 0);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const isIncremental = !!lastTimestamp;

      // Track the actual read count
      readCounter.recordListenerUpdate(listenerId, 'taskComments', 'subscribeToTaskComments', snapshot.size);

      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(comments, isIncremental);
    }, (error) => {
      secureLogger.error('Error in task comments listener', { taskId, error: error.message });
      readCounter.recordError('taskComments', 'subscribeToTaskComments', error.message);
    });

    return () => {
      readCounter.removeListener(listenerId);
      unsubscribe();
    };
  } catch (error) {
    secureLogger.error('Error setting up task comments listener', { taskId, error: error.message });
    readCounter.recordError('taskComments', 'subscribeToTaskComments', error.message);
    throw error;
  }
};

// Update a comment
export const updateTaskComment = async (taskId, commentId, updates) => {
  try {
    const commentRef = doc(firestore, 'tasks', taskId, 'comments', commentId);

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(commentRef, updateData);
    readCounter.recordRead('updateDoc', 'taskComments', 'updateTaskComment', 1);
    secureLogger.debug('Comment updated successfully', { taskId, commentId });

    // Update comment in cache
    taskCommentsCacheService.updateCommentInCache(taskId, commentId, updateData);

    return true;
  } catch (error) {
    secureLogger.error('Error updating comment', { taskId, commentId, error: error.message });
    readCounter.recordError('taskComments', 'updateTaskComment', error.message);
    throw error;
  }
};

// Delete a comment
export const deleteTaskComment = async (taskId, commentId) => {
  try {
    const commentRef = doc(firestore, 'tasks', taskId, 'comments', commentId);
    await deleteDoc(commentRef);

    // Decrement comment count on task
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    if (taskDoc.exists()) {
      const currentCount = taskDoc.data().commentCount || 0;
      await updateDoc(taskRef, {
        commentCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp()
      });
    }

    secureLogger.debug('Comment deleted successfully', { taskId, commentId });

    // Remove comment from cache
    taskCommentsCacheService.removeCommentFromCache(taskId, commentId);

    return true;
  } catch (error) {
    secureLogger.error('Error deleting comment', { taskId, commentId, error: error.message });
    readCounter.recordError('taskComments', 'deleteTaskComment', error.message);
    throw error;
  }
};

// Update subtask completion status
export const updateSubtaskStatus = async (taskId, subtaskId, completed, userId) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);

    if (!taskDoc.exists()) {
      throw new Error('Task not found');
    }

    const taskData = taskDoc.data();
    const subtasks = taskData.subtasks || [];

    const updatedSubtasks = subtasks.map(subtask => {
      if (subtask.id === subtaskId) {
        return {
          ...subtask,
          completed,
          completedAt: completed ? Timestamp.now() : null,
          completedBy: completed ? userId : null
        };
      }
      return subtask;
    });

    await updateDoc(taskRef, {
      subtasks: updatedSubtasks,
      updatedAt: serverTimestamp()
    });

    readCounter.recordRead('updateDoc', 'tasks', 'updateSubtaskStatus', 1);
    secureLogger.debug('Subtask status updated', { taskId, subtaskId, completed });

    return true;
  } catch (error) {
    secureLogger.error('Error updating subtask status', { taskId, subtaskId, error: error.message });
    readCounter.recordError('tasks', 'updateSubtaskStatus', error.message);
    throw error;
  }
};

// Get a single task
export const getTask = async (taskId) => {
  try {
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);

    readCounter.recordRead('getDoc', 'tasks', 'getTask', 1);

    if (taskDoc.exists()) {
      return { id: taskDoc.id, ...taskDoc.data() };
    }

    return null;
  } catch (error) {
    secureLogger.error('Error fetching task', { taskId, error: error.message });
    readCounter.recordError('tasks', 'getTask', error.message);
    throw error;
  }
};
