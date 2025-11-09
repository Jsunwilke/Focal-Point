// src/contexts/TaskContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserTasks,
  getOrganizationTasks,
  createTask as createTaskFirebase,
  updateTask as updateTaskFirebase,
  deleteTask as deleteTaskFirebase,
  subscribeToUserTasks,
  subscribeToOrganizationTasks,
  updateSubtaskStatus as updateSubtaskStatusFirebase,
  addTaskComment,
  getTaskComments,
  subscribeToTaskComments
} from '../firebase/tasks';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import taskCacheService from '../services/taskCacheService';
import taskCommentsCacheService from '../services/taskCommentsCacheService';
import { readCounter } from '../services/readCounter';
import { Timestamp } from 'firebase/firestore';

const TaskContext = createContext();

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider = ({ children }) => {
  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelFilter, setPanelFilter] = useState('all'); // 'all', 'today', 'urgent', 'watching'

  const { showToast } = useToast();
  const { userProfile, organization } = useAuth();

  // Refs for listeners
  const userTasksListenerRef = useRef(null);
  const teamTasksListenerRef = useRef(null);

  // Check if user can view team tasks (admin/manager)
  const canViewTeamTasks = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  // Load user tasks with cache-first approach
  const loadMyTasks = useCallback(async () => {
    if (!userProfile?.id || !organization?.id) {
      return;
    }

    try {
      // Check cache first
      const cachedTasks = taskCacheService.getCachedTasks(userProfile.id, organization.id, 'all');
      if (cachedTasks) {
        setMyTasks(cachedTasks);
        readCounter.recordCacheHit('tasks', 'TaskContext-myTasks', cachedTasks.length);
        return; // Exit early if cache hit
      }

      // Cache miss - fetch from Firestore
      readCounter.recordCacheMiss('tasks', 'TaskContext-myTasks');
      const tasks = await getUserTasks(userProfile.id, organization.id);

      // Cache the tasks
      taskCacheService.setCachedTasks(userProfile.id, organization.id, 'all', tasks);
      setMyTasks(tasks);
    } catch (error) {
      console.error('Error loading my tasks:', error);
      setMyTasks([]);
    }
  }, [userProfile?.id, organization?.id]);

  // Load team tasks with cache-first approach (for admins/managers)
  const loadTeamTasks = useCallback(async () => {
    if (!organization?.id || !canViewTeamTasks) {
      return;
    }

    try {
      // Check cache first
      const cachedTasks = taskCacheService.getCachedTeamTasks(organization.id);
      if (cachedTasks) {
        setTeamTasks(cachedTasks);
        readCounter.recordCacheHit('tasks', 'TaskContext-teamTasks', cachedTasks.length);
        return; // Exit early if cache hit
      }

      // Cache miss - fetch from Firestore
      readCounter.recordCacheMiss('tasks', 'TaskContext-teamTasks');
      const tasks = await getOrganizationTasks(organization.id);

      // Cache the tasks
      taskCacheService.setCachedTeamTasks(organization.id, tasks);
      setTeamTasks(tasks);
    } catch (error) {
      console.error('Error loading team tasks:', error);
      setTeamTasks([]);
    }
  }, [organization?.id, canViewTeamTasks]);

  // Set up real-time listener for user tasks
  const setupUserTasksListener = useCallback(() => {
    if (!userProfile?.id || !organization?.id) {
      return;
    }

    // Clean up existing listener
    if (userTasksListenerRef.current) {
      userTasksListenerRef.current();
      userTasksListenerRef.current = null;
    }

    // Get latest timestamp from cache for optimized listener
    const latestTimestamp = taskCacheService.getLatestTimestamp(userProfile.id, organization.id, 'all');

    const unsubscribe = subscribeToUserTasks(
      userProfile.id,
      organization.id,
      (newTasks, isIncremental) => {
        if (isIncremental && latestTimestamp) {
          // Merge new tasks with cached tasks
          setMyTasks(prevTasks => {
            const taskMap = new Map();

            // Add existing tasks
            prevTasks.forEach(task => taskMap.set(task.id, task));

            // Add/update with new tasks
            newTasks.forEach(task => taskMap.set(task.id, task));

            const mergedTasks = Array.from(taskMap.values());

            // Update cache
            taskCacheService.setCachedTasks(userProfile.id, organization.id, 'all', mergedTasks);

            return mergedTasks;
          });
        } else {
          // Full refresh
          setMyTasks(newTasks);
          taskCacheService.setCachedTasks(userProfile.id, organization.id, 'all', newTasks);
        }
      },
      latestTimestamp
    );

    userTasksListenerRef.current = unsubscribe;
  }, [userProfile?.id, organization?.id]);

  // Set up real-time listener for team tasks
  const setupTeamTasksListener = useCallback(() => {
    if (!organization?.id || !canViewTeamTasks) {
      return;
    }

    // Clean up existing listener
    if (teamTasksListenerRef.current) {
      teamTasksListenerRef.current();
      teamTasksListenerRef.current = null;
    }

    // Get latest timestamp from cache for optimized listener
    const cachedTasks = taskCacheService.getCachedTeamTasks(organization.id);
    let latestTimestamp = null;

    if (cachedTasks && cachedTasks.length > 0) {
      cachedTasks.forEach(task => {
        const taskTimestamp = task.updatedAt || task.createdAt;
        if (taskTimestamp && taskTimestamp.toMillis) {
          if (!latestTimestamp || taskTimestamp.toMillis() > latestTimestamp.toMillis()) {
            latestTimestamp = taskTimestamp;
          }
        }
      });
    }

    const unsubscribe = subscribeToOrganizationTasks(
      organization.id,
      (newTasks, isIncremental) => {
        if (isIncremental && latestTimestamp) {
          // Merge new tasks with cached tasks
          setTeamTasks(prevTasks => {
            const taskMap = new Map();

            // Add existing tasks
            prevTasks.forEach(task => taskMap.set(task.id, task));

            // Add/update with new tasks
            newTasks.forEach(task => taskMap.set(task.id, task));

            const mergedTasks = Array.from(taskMap.values());

            // Update cache
            taskCacheService.setCachedTeamTasks(organization.id, mergedTasks);

            return mergedTasks;
          });
        } else {
          // Full refresh
          setTeamTasks(newTasks);
          taskCacheService.setCachedTeamTasks(organization.id, newTasks);
        }
      },
      latestTimestamp
    );

    teamTasksListenerRef.current = unsubscribe;
  }, [organization?.id, canViewTeamTasks]);

  // Initialize - load from cache and set up listeners
  useEffect(() => {
    if (userProfile?.id && organization?.id) {
      setLoading(true);

      // Load tasks from cache first
      loadMyTasks().then(() => {
        // Then set up real-time listener
        setupUserTasksListener();
        setLoading(false);
      });

      // Load team tasks if user has permission
      if (canViewTeamTasks) {
        loadTeamTasks().then(() => {
          setupTeamTasksListener();
        });
      }
    }

    // Cleanup listeners on unmount
    return () => {
      if (userTasksListenerRef.current) {
        userTasksListenerRef.current();
      }
      if (teamTasksListenerRef.current) {
        teamTasksListenerRef.current();
      }
    };
  }, [userProfile?.id, organization?.id, canViewTeamTasks]);

  // Create a new task
  const createTask = useCallback(async (taskData) => {
    try {
      const newTask = await createTaskFirebase({
        ...taskData,
        organizationID: organization.id,
        createdBy: userProfile.id
      });

      showToast('Task created successfully', 'success');

      // Optimistically add the new task to local state
      // The real-time listener will ensure it stays in sync
      setMyTasks(prevTasks => {
        const updatedTasks = [newTask, ...prevTasks];
        // Update cache with the new task
        taskCacheService.setCachedTasks(userProfile.id, organization.id, 'all', updatedTasks);
        return updatedTasks;
      });

      if (canViewTeamTasks) {
        setTeamTasks(prevTasks => {
          const updatedTasks = [newTask, ...prevTasks];
          taskCacheService.setCachedTeamTasks(organization.id, updatedTasks);
          return updatedTasks;
        });
      }

      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      showToast('Failed to create task', 'error');
      throw error;
    }
  }, [organization?.id, userProfile?.id, canViewTeamTasks]);

  // Update a task
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      await updateTaskFirebase(taskId, updates);

      showToast('Task updated successfully', 'success');

      // Update task in state
      setMyTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, ...updates } : task
        )
      );

      if (canViewTeamTasks) {
        setTeamTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          )
        );
      }

      return true;
    } catch (error) {
      console.error('Error updating task:', error);
      showToast('Failed to update task', 'error');
      throw error;
    }
  }, [canViewTeamTasks]);

  // Delete a task
  const deleteTask = useCallback(async (taskId) => {
    try {
      await deleteTaskFirebase(taskId, organization.id);

      showToast('Task deleted successfully', 'success');

      // Remove task from state
      setMyTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

      if (canViewTeamTasks) {
        setTeamTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      }

      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      showToast('Failed to delete task', 'error');
      throw error;
    }
  }, [organization?.id, canViewTeamTasks]);

  // Mark task as complete
  const markTaskComplete = useCallback(async (taskId) => {
    try {
      await updateTaskFirebase(taskId, {
        status: 'completed',
        completedAt: Timestamp.now(),
        completedBy: userProfile.id
      });

      showToast('Task marked as complete', 'success');

      return true;
    } catch (error) {
      console.error('Error marking task complete:', error);
      showToast('Failed to mark task complete', 'error');
      throw error;
    }
  }, [userProfile?.id]);

  // Update subtask status
  const updateSubtaskStatus = useCallback(async (taskId, subtaskId, completed) => {
    try {
      await updateSubtaskStatusFirebase(taskId, subtaskId, completed, userProfile.id);

      return true;
    } catch (error) {
      console.error('Error updating subtask:', error);
      showToast('Failed to update subtask', 'error');
      throw error;
    }
  }, [userProfile?.id]);

  // Add comment to task
  const addComment = useCallback(async (taskId, comment) => {
    try {
      const newComment = await addTaskComment(taskId, {
        userId: userProfile.id,
        userName: `${userProfile.firstName} ${userProfile.lastName}`,
        text: comment.text,
        attachments: comment.attachments || [],
        mentions: comment.mentions || []
      });

      showToast('Comment added', 'success');

      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Failed to add comment', 'error');
      throw error;
    }
  }, [userProfile?.id, userProfile?.firstName, userProfile?.lastName]);

  // Panel controls
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // Get filtered tasks for panel
  const getPanelTasks = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter myTasks to only show tasks actually relevant to the user:
    // 1. Tasks assigned to me, OR
    // 2. Tasks I created that are unassigned
    let filteredTasks = myTasks.filter(task => {
      // If task is assigned to me, include it
      if (task.assignedTo && task.assignedTo.includes(userProfile.id)) {
        return true;
      }
      // If I created it and it's unassigned, include it
      if (task.createdBy === userProfile.id && (!task.assignedTo || task.assignedTo.length === 0)) {
        return true;
      }
      // Otherwise exclude (tasks I created but assigned to others)
      return false;
    });

    switch (panelFilter) {
      case 'completed':
        // Show only completed tasks
        filteredTasks = filteredTasks.filter(task => task.status === 'completed');
        break;

      case 'today':
        // Due today or overdue (exclude completed)
        filteredTasks = filteredTasks.filter(task => {
          if (task.status === 'completed' || task.status === 'cancelled') return false;
          if (!task.dueDate) return false;
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          return dueDate < tomorrow;
        });
        break;

      case 'urgent':
        // High or urgent priority (exclude completed)
        filteredTasks = filteredTasks.filter(task => {
          if (task.status === 'completed' || task.status === 'cancelled') return false;
          return task.priority === 'urgent' || task.priority === 'high';
        });
        break;

      case 'watching':
        // Tasks created by user or where user has commented (exclude completed)
        filteredTasks = filteredTasks.filter(task => {
          if (task.status === 'completed' || task.status === 'cancelled') return false;
          return task.createdBy === userProfile.id || task.commentCount > 0;
        });
        break;

      case 'all':
      default:
        // All active tasks (exclude completed and cancelled)
        filteredTasks = filteredTasks.filter(task => task.status !== 'completed' && task.status !== 'cancelled');
        break;
    }

    // Sort by due date (earliest first), then by priority
    return filteredTasks.sort((a, b) => {
      // First by due date
      if (a.dueDate && b.dueDate) {
        const aDate = a.dueDate.toMillis ? a.dueDate.toMillis() : new Date(a.dueDate).getTime();
        const bDate = b.dueDate.toMillis ? b.dueDate.toMillis() : new Date(b.dueDate).getTime();
        if (aDate !== bDate) {
          return aDate - bDate;
        }
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }

      // Then by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }, [myTasks, panelFilter, userProfile?.id]);

  // Permission checks
  const canCreateTask = useCallback((user) => {
    return !!user; // All authenticated users can create tasks
  }, []);

  const canAssignTask = useCallback((user, task) => {
    if (!user) return false;
    // Admins and managers can assign to anyone
    if (user.role === 'admin' || user.role === 'manager') return true;
    // Task creator can assign
    if (task && task.createdBy === user.id) return true;
    // Users can only assign to themselves
    return false;
  }, []);

  const canEditTask = useCallback((user, task) => {
    if (!user || !task) return false;
    // Admins and managers can edit any task
    if (user.role === 'admin' || user.role === 'manager') return true;
    // Task creator can edit
    if (task.createdBy === user.id) return true;
    // Assignees can edit
    if (task.assignedTo && task.assignedTo.includes(user.id)) return true;
    return false;
  }, []);

  const canDeleteTask = useCallback((user, task) => {
    if (!user || !task) return false;
    // Admins can delete any task
    if (user.role === 'admin') return true;
    // Task creator can delete (if not completed)
    if (task.createdBy === user.id && task.status !== 'completed') return true;
    return false;
  }, []);

  const value = {
    // State
    myTasks,
    teamTasks,
    loading,
    isPanelOpen,
    panelFilter,

    // Actions
    createTask,
    updateTask,
    deleteTask,
    markTaskComplete,
    updateSubtaskStatus,
    addComment,

    // Panel controls
    togglePanel,
    openPanel,
    closePanel,
    setPanelFilter,
    getPanelTasks,

    // Permissions
    canCreateTask,
    canAssignTask,
    canEditTask,
    canDeleteTask,
    canViewTeamTasks,

    // Utilities
    loadMyTasks,
    loadTeamTasks
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
};
