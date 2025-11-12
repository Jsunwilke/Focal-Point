// src/contexts/TaskContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserTasks,
  getOrganizationTasks,
  getTask,
  createTask as createTaskFirebase,
  updateTask as updateTaskFirebase,
  deleteTask as deleteTaskFirebase,
  batchUpdateTaskOrders,
  subscribeToUserTasks,
  subscribeToOrganizationTasks,
  updateSubtaskStatus as updateSubtaskStatusFirebase,
  addTaskComment,
  getTaskComments,
  subscribeToTaskComments
} from '../firebase/tasks';
import { logActivity, ACTIVITY_TYPES } from '../firebase/activity';
import { watchTask as watchTaskFirebase, unwatchTask as unwatchTaskFirebase, autoWatchTask } from '../firebase/taskWatchers';
import { createMentionNotifications } from '../firebase/taskNotifications';
import { clockOutTaskTimeEntry } from '../firebase/firestore';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';
import taskCacheService from '../services/taskCacheService';
import taskCommentsCacheService from '../services/taskCommentsCacheService';
import { readCounter } from '../services/readCounter';
import { Timestamp } from 'firebase/firestore';
import { TASK_STATUS } from '../constants/taskStatus';
import { notifyTaskAssignment, notifyStatusChange, notifyComment, notifyMention } from '../services/taskNotificationHelper';

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
  const [selectedTaskId, setSelectedTaskId] = useState(null); // For panel task selection

  const { showToast } = useToast();
  const { userProfile, organization } = useAuth();

  // Refs for listeners
  const userTasksListenerRef = useRef(null);
  const teamTasksListenerRef = useRef(null);

  // Refs for initialization tracking (prevents race conditions)
  const userTasksInitialized = useRef(false);
  const teamTasksInitialized = useRef(false);

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
    if (!userProfile?.id || !organization?.id) {
      return;
    }

    setLoading(true);

    // Reset initialization flags
    userTasksInitialized.current = false;
    teamTasksInitialized.current = false;

    // RACE CONDITION FIX: Coordinate loading and listener setup
    const initializeTasks = async () => {
      try {
        // Step 1: Load user tasks from cache first
        await loadMyTasks();
        userTasksInitialized.current = true;

        // Step 2: Set up user tasks listener AFTER initial load
        setupUserTasksListener();

        // Step 3: Load team tasks if user has permission
        if (canViewTeamTasks) {
          await loadTeamTasks();
          teamTasksInitialized.current = true;

          // Step 4: Set up team tasks listener AFTER initial load
          setupTeamTasksListener();
        } else {
          // Mark team tasks as "initialized" (not needed) so loading can complete
          teamTasksInitialized.current = true;
        }

        // Step 5: Clear loading state only after all initialization is complete
        setLoading(false);
      } catch (error) {
        console.error('Error initializing tasks:', error);
        setLoading(false);
      }
    };

    initializeTasks();

    // Cleanup listeners on unmount or when dependencies change
    return () => {
      if (userTasksListenerRef.current) {
        userTasksListenerRef.current();
        userTasksListenerRef.current = null;
      }
      if (teamTasksListenerRef.current) {
        teamTasksListenerRef.current();
        teamTasksListenerRef.current = null;
      }
      userTasksInitialized.current = false;
      teamTasksInitialized.current = false;
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

      // Log activity
      try {
        await logActivity(
          newTask.id,
          ACTIVITY_TYPES.TASK_CREATED,
          { title: newTask.title },
          userProfile.id,
          organization.id
        );
      } catch (activityError) {
        console.error('Failed to log task creation activity:', activityError);
      }

      // Send assignment notifications
      if (taskData.assignedTo && taskData.assignedTo.length > 0) {
        try {
          await notifyTaskAssignment(newTask, taskData.assignedTo, userProfile.id);
        } catch (notifError) {
          console.error('Failed to send assignment notifications:', notifError);
          // Don't fail task creation if notification fails
        }
      }

      showToast('Task created successfully', 'success');

      // Real-time listener will add the task to state automatically
      // No need for optimistic update since listener is fast enough

      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      showToast('Unable to Create Task', 'Your task could not be created. Please check your connection and try again.', 'error');
      throw error;
    }
  }, [organization?.id, userProfile?.id, canViewTeamTasks]);

  // Duplicate a task
  const duplicateTask = useCallback(async (taskId) => {
    try {
      // Find the original task in state first
      let originalTask = [...myTasks, ...teamTasks].find(t => t.id === taskId);

      // If not found in state, fetch from Firestore
      if (!originalTask) {
        originalTask = await getTask(taskId);
        if (!originalTask) {
          throw new Error('Task not found');
        }
      }

      // Create duplicate with specific fields reset
      const duplicateData = {
        title: `${originalTask.title} (Copy)`,
        description: originalTask.description || '',
        type: originalTask.type || 'general',
        priority: originalTask.priority || 'medium',
        assignedTo: originalTask.assignedTo || [],
        dueDate: originalTask.dueDate,
        estimatedHours: originalTask.estimatedHours || 0,
        sessionId: originalTask.sessionId,
        sessionName: originalTask.sessionName,
        sessionDate: originalTask.sessionDate,
        workflowId: originalTask.workflowId,
        workflowStepId: originalTask.workflowStepId,
        workflowName: originalTask.workflowName,
        workflowStepName: originalTask.workflowStepName,
        // Duplicate subtasks but reset their completion status
        subtasks: originalTask.subtasks?.map(st => ({
          ...st,
          completed: false,
          completedAt: null,
          completedBy: null
        })) || [],
        // Reset status and completion fields
        status: TASK_STATUS.TODO,
        completedAt: null,
        completedBy: null,
        commentCount: 0
      };

      const newTask = await createTask(duplicateData);
      showToast('Task duplicated successfully', 'success');
      return newTask;
    } catch (error) {
      console.error('Error duplicating task:', error);
      showToast('Unable to Duplicate Task', 'The task could not be duplicated. Please try again.', 'error');
      throw error;
    }
  }, [myTasks, teamTasks, createTask]);

  // Update a task
  const updateTask = useCallback(async (taskId, updates) => {
    try {
      // Get the current task to track changes
      const currentTask = [...myTasks, ...teamTasks].find(t => t.id === taskId);

      await updateTaskFirebase(taskId, updates);

      // Log activities for specific field changes
      if (currentTask && userProfile?.id && organization?.id) {
        try {
          // Status change
          if (updates.status && updates.status !== currentTask.status) {
            await logActivity(
              taskId,
              ACTIVITY_TYPES.STATUS_CHANGED,
              { oldStatus: currentTask.status, newStatus: updates.status },
              userProfile.id,
              organization.id
            );
          }

          // Priority change
          if (updates.priority && updates.priority !== currentTask.priority) {
            await logActivity(
              taskId,
              ACTIVITY_TYPES.PRIORITY_CHANGED,
              { oldPriority: currentTask.priority, newPriority: updates.priority },
              userProfile.id,
              organization.id
            );
          }

          // Due date change
          if (updates.dueDate !== undefined) {
            const oldDate = currentTask.dueDate?.toMillis?.() || null;
            const newDate = updates.dueDate?.toMillis?.() || null;
            if (oldDate !== newDate) {
              await logActivity(
                taskId,
                ACTIVITY_TYPES.DUE_DATE_CHANGED,
                { oldDueDate: oldDate, newDueDate: newDate },
                userProfile.id,
                organization.id
              );
            }
          }

          // Title change
          if (updates.title && updates.title !== currentTask.title) {
            await logActivity(
              taskId,
              ACTIVITY_TYPES.TITLE_UPDATED,
              { oldTitle: currentTask.title, newTitle: updates.title },
              userProfile.id,
              organization.id
            );
          }

          // Description change
          if (updates.description !== undefined && updates.description !== currentTask.description) {
            await logActivity(
              taskId,
              ACTIVITY_TYPES.DESCRIPTION_UPDATED,
              {},
              userProfile.id,
              organization.id
            );
          }

          // Assignee changes
          if (updates.assignedTo) {
            const oldAssignees = currentTask.assignedTo || [];
            const newAssignees = updates.assignedTo || [];

            // Find added assignees
            const added = newAssignees.filter(id => !oldAssignees.includes(id));
            for (const assigneeId of added) {
              await logActivity(
                taskId,
                ACTIVITY_TYPES.ASSIGNEE_ADDED,
                { assigneeId },
                userProfile.id,
                organization.id
              );
            }

            // Find removed assignees
            const removed = oldAssignees.filter(id => !newAssignees.includes(id));
            for (const assigneeId of removed) {
              await logActivity(
                taskId,
                ACTIVITY_TYPES.ASSIGNEE_REMOVED,
                { assigneeId },
                userProfile.id,
                organization.id
              );
            }

            // Send notifications to newly added assignees
            if (added.length > 0) {
              try {
                await notifyTaskAssignment({ ...currentTask, ...updates }, added, userProfile.id);
              } catch (notifError) {
                console.error('Failed to send assignment notifications:', notifError);
              }
            }
          }

          // Status change notifications
          if (updates.status && updates.status !== currentTask.status) {
            try {
              await notifyStatusChange(
                { ...currentTask, ...updates },
                currentTask.status,
                updates.status,
                userProfile.id
              );
            } catch (notifError) {
              console.error('Failed to send status change notifications:', notifError);
            }
          }
        } catch (activityError) {
          console.error('Failed to log task update activity:', activityError);
        }
      }

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
      showToast('Unable to Save Changes', 'Your task updates could not be saved. Please check your connection and try again.', 'error');
      throw error;
    }
  }, [canViewTeamTasks, myTasks, teamTasks, userProfile?.id, organization?.id]);

  // Permission check: Can user delete this task?
  const canDeleteTask = useCallback((user, task) => {
    if (!user || !task) return false;

    // Admins can delete any task (including completed tasks)
    if (user.role === 'admin') return true;

    // Non-admins cannot delete completed tasks (business rule: protect completed work)
    if (task.status === TASK_STATUS.COMPLETED) return false;

    // Task creator can delete their own non-completed tasks
    if (task.createdBy === user.id) return true;

    return false;
  }, []);

  // Delete a task
  const deleteTask = useCallback(async (taskId) => {
    try {
      if (!organization?.id) {
        throw new Error('Organization ID is missing');
      }

      // Find the task in state first (avoid unnecessary Firestore read)
      let task = [...myTasks, ...teamTasks].find(t => t.id === taskId);

      // Check permissions BEFORE any Firestore operations
      if (task) {
        if (!canDeleteTask(userProfile, task)) {
          throw new Error('You do not have permission to delete this task');
        }
      } else {
        // Task not in cache - need to fetch to check permissions
        task = await getTask(taskId);

        if (!task) {
          throw new Error('Task not found');
        }

        if (!canDeleteTask(userProfile, task)) {
          throw new Error('You do not have permission to delete this task');
        }
      }

      // Permission check passed - proceed with deletion
      await deleteTaskFirebase(taskId, organization.id);

      // Clear cache to prevent deleted task from reappearing on refresh
      taskCacheService.clearOrganizationCache(organization.id);

      showToast('Task deleted successfully', 'success');

      // Remove task from state
      setMyTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));

      if (canViewTeamTasks) {
        setTeamTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      }

      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      console.error('Organization ID:', organization?.id);
      console.error('User ID:', userProfile?.id);
      showToast(`Failed to delete task: ${error.message}`, 'error');
      throw error;
    }
  }, [organization?.id, canViewTeamTasks, userProfile, myTasks, teamTasks, canDeleteTask]);

  // Mark task as complete
  const markTaskComplete = useCallback(async (taskId) => {
    try {
      const currentTask = [...myTasks, ...teamTasks].find(t => t.id === taskId);

      await updateTaskFirebase(taskId, {
        status: TASK_STATUS.COMPLETED,
        completedAt: Timestamp.now(),
        completedBy: userProfile.id
      });

      // Auto-stop time tracking if user is tracking this task
      if (userProfile?.id && organization?.id) {
        try {
          await clockOutTaskTimeEntry(userProfile.id, organization.id, taskId);
        } catch (timeError) {
          console.error('Failed to auto-stop time tracking:', timeError);
          // Don't fail task completion if time tracking fails
        }
      }

      // Log activity
      if (userProfile?.id && organization?.id) {
        try {
          const activityType = currentTask?.status === 'completed'
            ? ACTIVITY_TYPES.TASK_REOPENED
            : ACTIVITY_TYPES.TASK_COMPLETED;

          await logActivity(
            taskId,
            activityType,
            {},
            userProfile.id,
            organization.id
          );
        } catch (activityError) {
          console.error('Failed to log task completion activity:', activityError);
        }
      }

      showToast('Task marked as complete', 'success');

      return true;
    } catch (error) {
      console.error('Error marking task complete:', error);
      showToast('Unable to Complete Task', 'The task could not be marked as complete. Please try again.', 'error');
      throw error;
    }
  }, [userProfile?.id, organization?.id, myTasks, teamTasks]);

  // Update subtask status
  const updateSubtaskStatus = useCallback(async (taskId, subtaskId, completed) => {
    try {
      const currentTask = [...myTasks, ...teamTasks].find(t => t.id === taskId);
      const subtask = currentTask?.subtasks?.find(st => st.id === subtaskId);

      // OPTIMIZATION: Pass cached task to avoid Firestore read
      await updateSubtaskStatusFirebase(taskId, subtaskId, completed, userProfile.id, currentTask);

      // Log activity
      if (subtask && userProfile?.id && organization?.id) {
        try {
          const activityType = completed
            ? ACTIVITY_TYPES.SUBTASK_COMPLETED
            : ACTIVITY_TYPES.SUBTASK_UNCOMPLETED;

          await logActivity(
            taskId,
            activityType,
            { subtaskTitle: subtask.title },
            userProfile.id,
            organization.id
          );
        } catch (activityError) {
          console.error('Failed to log subtask update activity:', activityError);
        }
      }

      return true;
    } catch (error) {
      console.error('Error updating subtask:', error);
      showToast('Unable to Update Subtask', 'The subtask status could not be updated. Please try again.', 'error');
      throw error;
    }
  }, [userProfile?.id, organization?.id, myTasks, teamTasks]);

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

      // Find the task to get its title
      const task = [...myTasks, ...teamTasks].find(t => t.id === taskId);

      // Log activity
      if (userProfile?.id && organization?.id) {
        try {
          await logActivity(
            taskId,
            ACTIVITY_TYPES.COMMENT_ADDED,
            { commentPreview: comment.text.substring(0, 100) },
            userProfile.id,
            organization.id
          );
        } catch (activityError) {
          console.error('Failed to log comment activity:', activityError);
        }
      }

      // Create mention notifications
      if (comment.mentions && comment.mentions.length > 0 && task) {
        try {
          await createMentionNotifications({
            mentions: comment.mentions,
            taskId,
            taskTitle: task.title,
            commentText: comment.text,
            triggeredBy: userProfile.id,
            triggeredByName: `${userProfile.firstName} ${userProfile.lastName}`,
            organizationID: organization.id
          });

          // Send email notifications for mentions
          for (const mention of comment.mentions) {
            try {
              await notifyMention(task, mention.userId, userProfile.id, newComment);
            } catch (notifError) {
              console.error('Failed to send mention email notification:', notifError);
            }
          }
        } catch (notificationError) {
          console.error('Failed to create mention notifications:', notificationError);
        }
      }

      // Send comment notification to watchers
      if (task) {
        try {
          await notifyComment(task, userProfile.id, newComment);
        } catch (notifError) {
          console.error('Failed to send comment notifications:', notifError);
        }
      }

      // Auto-watch task for mentioned users
      if (comment.mentions && comment.mentions.length > 0) {
        comment.mentions.forEach(async (mention) => {
          try {
            // Pass task object to avoid unnecessary Firestore read
            await autoWatchTask(taskId, mention.userId, organization.id, 'mention', task);
          } catch (watchError) {
            console.error('Failed to auto-watch task for mentioned user:', watchError);
          }
        });
      }

      showToast('Comment added', 'success');

      return newComment;
    } catch (error) {
      console.error('Error adding comment:', error);
      showToast('Unable to Add Comment', 'Your comment could not be added. Please try again.', 'error');
      throw error;
    }
  }, [userProfile?.id, userProfile?.firstName, userProfile?.lastName, organization?.id, myTasks, teamTasks]);

  // Panel controls
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedTaskId(null); // Clear selection when panel closes
  }, []);

  const clearSelectedTask = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const openPanelWithTask = useCallback((taskId) => {
    setSelectedTaskId(taskId);
    setIsPanelOpen(true);
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

  // Watch task
  const watchTask = useCallback(async (taskId) => {
    try {
      if (!userProfile?.id || !organization?.id) {
        throw new Error('User or organization not found');
      }

      await watchTaskFirebase(taskId, userProfile.id, organization.id);
      showToast('You are now watching this task', 'success');

      // Update task in cache with new watcher
      const updateTaskInCache = (tasks) => {
        return tasks.map(task => {
          if (task.id === taskId) {
            const watchers = task.watchers || [];
            if (!watchers.includes(userProfile.id)) {
              return { ...task, watchers: [...watchers, userProfile.id] };
            }
          }
          return task;
        });
      };

      setMyTasks(prev => updateTaskInCache(prev));
      if (canViewTeamTasks) {
        setTeamTasks(prev => updateTaskInCache(prev));
      }

      return true;
    } catch (error) {
      console.error('Error watching task:', error);
      showToast(`Failed to watch task: ${error.message}`, 'error');
      throw error;
    }
  }, [userProfile?.id, organization?.id, canViewTeamTasks]);

  // Unwatch task
  const unwatchTask = useCallback(async (taskId) => {
    try {
      if (!userProfile?.id || !organization?.id) {
        throw new Error('User or organization not found');
      }

      await unwatchTaskFirebase(taskId, userProfile.id, organization.id);
      showToast('You are no longer watching this task', 'success');

      // Update task in cache removing watcher
      const updateTaskInCache = (tasks) => {
        return tasks.map(task => {
          if (task.id === taskId) {
            const watchers = task.watchers || [];
            return { ...task, watchers: watchers.filter(w => w !== userProfile.id) };
          }
          return task;
        });
      };

      setMyTasks(prev => updateTaskInCache(prev));
      if (canViewTeamTasks) {
        setTeamTasks(prev => updateTaskInCache(prev));
      }

      return true;
    } catch (error) {
      console.error('Error unwatching task:', error);
      showToast(`Failed to unwatch task: ${error.message}`, 'error');
      throw error;
    }
  }, [userProfile?.id, organization?.id, canViewTeamTasks]);

  // Check if user is watching a task
  const isWatchingTask = useCallback((task) => {
    if (!userProfile?.id || !task) return false;
    return task.watchers?.includes(userProfile.id) || false;
  }, [userProfile?.id]);

  const value = {
    // State
    myTasks,
    teamTasks,
    loading,
    isPanelOpen,
    panelFilter,
    selectedTaskId,

    // Actions
    createTask,
    duplicateTask,
    updateTask,
    deleteTask,
    batchUpdateTaskOrders,
    markTaskComplete,
    updateSubtaskStatus,
    addComment,
    watchTask,
    unwatchTask,
    isWatchingTask,

    // Panel controls
    togglePanel,
    openPanel,
    closePanel,
    setPanelFilter,
    getPanelTasks,
    setSelectedTaskId,
    clearSelectedTask,
    openPanelWithTask,

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
