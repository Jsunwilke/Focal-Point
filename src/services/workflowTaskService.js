// src/services/workflowTaskService.js
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { createTask, updateTask } from '../firebase/tasks';
import { readCounter } from './readCounter';
import { secureLogger } from './secureLogger';

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms (doubles each retry)
 * @returns {Promise<any>} Result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        secureLogger.debug(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

/**
 * Workflow Task Auto-Creation Service
 *
 * This service manages automatic task creation from workflow steps based on:
 * - Timeline triggers (create X days before due date)
 * - Dependency triggers (create when previous steps complete)
 * - Immediate triggers (create when workflow starts)
 *
 * Also handles bi-directional sync between tasks and workflow steps.
 */

// Configuration constants
const MAX_OVERDUE_DAYS = 30; // Maximum days overdue to create tasks for
const TASK_CREATION_RETRY_ATTEMPTS = 3; // Number of retries for task creation
const TASK_CREATION_BASE_DELAY = 1000; // Base delay for retry backoff (ms)

/**
 * Create a task from a workflow step
 * @param {Object} workflow - Workflow document data
 * @param {string} workflowId - Workflow ID
 * @param {Object} step - Step definition from template
 * @param {string} stepId - Step ID
 * @returns {Promise<string|null>} Created task ID or null
 */
export const createTaskForWorkflowStep = async (workflow, workflowId, step, stepId) => {
  try {
    const stepProgress = workflow.stepProgress[stepId];

    // Check if task already created
    if (stepProgress.taskCreated || stepProgress.linkedTaskId) {
      secureLogger.debug('Task already exists for workflow step', { workflowId, stepId, taskId: stepProgress.linkedTaskId });
      return stepProgress.linkedTaskId;
    }

    // Prepare task data
    const taskData = {
      title: step.title,
      description: step.description || '',
      type: 'workflow',
      status: 'todo',
      priority: step.priority || 'medium',
      organizationID: workflow.organizationID,
      createdBy: workflow.createdBy || null,
      assignedTo: stepProgress.assignedTo ? [stepProgress.assignedTo] : [],
      dueDate: stepProgress.dueDate ? Timestamp.fromDate(new Date(stepProgress.dueDate)) : null,
      estimatedHours: step.estimatedHours || null,

      // Workflow linkage
      workflowId,
      workflowStepId: stepId,
      autoCreated: true,
      syncWithWorkflow: true,

      // Session linkage if available
      sessionId: workflow.sessionId || null
    };

    // Create the task with retry logic
    const task = await retryWithBackoff(
      async () => await createTask(taskData),
      TASK_CREATION_RETRY_ATTEMPTS,
      TASK_CREATION_BASE_DELAY
    );

    if (task && task.id) {
      // Update workflow step progress with task linkage (with retry)
      const workflowRef = doc(firestore, 'workflows', workflowId);
      await retryWithBackoff(
        async () => await updateDoc(workflowRef, {
          [`stepProgress.${stepId}.linkedTaskId`]: task.id,
          [`stepProgress.${stepId}.taskCreated`]: true,
          [`stepProgress.${stepId}.updatedAt`]: Timestamp.now()
        }),
        TASK_CREATION_RETRY_ATTEMPTS,
        TASK_CREATION_BASE_DELAY
      );

      secureLogger.info('Auto-created task for workflow step', {
        workflowId,
        stepId,
        taskId: task.id,
        title: step.title
      });

      return task.id;
    }

    secureLogger.warn('Task creation returned null result', { workflowId, stepId });
    return null;
  } catch (error) {
    secureLogger.error('Error creating task for workflow step', {
      error: error.message,
      workflowId,
      stepId
    });
    readCounter.recordError('workflows', 'createTaskForWorkflowStep', error.message);
    throw error;
  }
};

/**
 * Create tasks with immediate trigger for a specific workflow
 * Called when a workflow is created or activated
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<number>} Number of tasks created
 */
export const checkImmediateTasks = async (workflowId) => {
  try {
    let tasksCreated = 0;

    // Get workflow
    const workflowRef = doc(firestore, 'workflows', workflowId);
    const workflowDoc = await getDoc(workflowRef);
    readCounter.recordRead('get', 'workflows', 'checkImmediateTasks', 1);

    if (!workflowDoc.exists()) {
      return 0;
    }

    const workflow = workflowDoc.data();

    // Check if auto-create is enabled
    if (!workflow.autoCreateTasks) {
      return 0;
    }

    // Get workflow template
    const templateRef = doc(firestore, 'workflowTemplates', workflow.templateId);
    const templateDoc = await getDoc(templateRef);
    readCounter.recordRead('get', 'workflowTemplates', 'checkImmediateTasks', 1);

    if (!templateDoc.exists()) {
      return 0;
    }

    const template = templateDoc.data();

    // Check each step for immediate trigger
    for (const step of template.steps) {
      const stepProgress = workflow.stepProgress[step.id];

      if (!stepProgress || stepProgress.taskCreated) {
        continue; // Skip if no progress or task already created
      }

      // Read task creation trigger from stepProgress (includes overrides)
      const taskCreationTrigger = stepProgress.taskCreationTrigger || step.taskCreationTrigger || 'manual';

      if (taskCreationTrigger === 'immediate') {
        // Create task immediately
        const taskId = await createTaskForWorkflowStep(workflow, workflowId, step, step.id);
        if (taskId) {
          tasksCreated++;
          secureLogger.debug('Created immediate-trigger task', {
            workflowId,
            stepId: step.id,
            taskId
          });
        }
      }
    }

    if (tasksCreated > 0) {
      secureLogger.info('Created immediate-trigger tasks for workflow', {
        workflowId,
        tasksCreated
      });
    }

    return tasksCreated;
  } catch (error) {
    secureLogger.error('Error checking immediate tasks', {
      workflowId,
      error: error.message
    });
    readCounter.recordError('workflows', 'checkImmediateTasks', error.message);
    throw error;
  }
};

/**
 * Check all active workflows for timeline-based task creation
 * Creates tasks for steps where due date is within the threshold
 * @returns {Promise<Object>} Statistics about tasks created
 */
export const checkTimelineTasks = async () => {
  try {
    const stats = {
      workflowsChecked: 0,
      tasksCreated: 0,
      errors: 0
    };

    // Query all active workflows with autoCreateTasks enabled
    const workflowsRef = collection(firestore, 'workflows');
    const q = query(
      workflowsRef,
      where('status', '==', 'active'),
      where('autoCreateTasks', '==', true)
    );

    const snapshot = await getDocs(q);
    readCounter.recordRead('query', 'workflows', 'checkTimelineTasks', snapshot.size);

    stats.workflowsChecked = snapshot.size;

    // Check each workflow
    for (const workflowDoc of snapshot.docs) {
      const workflow = workflowDoc.data();
      const workflowId = workflowDoc.id;

      try {
        // Get workflow template to check step configurations
        const templateRef = doc(firestore, 'workflowTemplates', workflow.templateId);
        const templateDoc = await getDoc(templateRef);
        readCounter.recordRead('get', 'workflowTemplates', 'checkTimelineTasks', 1);

        if (!templateDoc.exists()) {
          continue;
        }

        const template = templateDoc.data();
        const now = new Date();

        // Check each step in the template
        for (const step of template.steps) {
          const stepProgress = workflow.stepProgress[step.id];

          if (!stepProgress || stepProgress.taskCreated) {
            continue; // Skip if no progress or task already created
          }

          // Read task creation settings from stepProgress (includes overrides)
          const taskCreationTrigger = stepProgress.taskCreationTrigger || step.taskCreationTrigger || 'manual';
          const taskCreationDaysBefore = stepProgress.taskCreationDaysBefore !== undefined
            ? stepProgress.taskCreationDaysBefore
            : (step.taskCreationDaysBefore || 7);

          // Check if this step has timeline trigger
          if (taskCreationTrigger === 'timeline') {
            const threshold = taskCreationDaysBefore;

            if (stepProgress.dueDate) {
              const dueDate = new Date(stepProgress.dueDate);
              const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

              // Create task if within threshold
              // Prevent creating hundreds of overdue tasks by limiting to MAX_OVERDUE_DAYS
              if (daysUntilDue <= threshold && daysUntilDue >= -MAX_OVERDUE_DAYS) {
                const taskId = await createTaskForWorkflowStep(workflow, workflowId, step, step.id);
                if (taskId) {
                  stats.tasksCreated++;
                }
              }
            }
          }
        }
      } catch (error) {
        secureLogger.error('Error checking timeline tasks for workflow', {
          workflowId,
          error: error.message
        });
        stats.errors++;
      }
    }

    secureLogger.info('Timeline task check complete', stats);
    return stats;
  } catch (error) {
    secureLogger.error('Error in checkTimelineTasks', { error: error.message });
    readCounter.recordError('workflows', 'checkTimelineTasks', error.message);
    throw error;
  }
};

/**
 * Check and create tasks for steps whose dependencies are now met
 * @param {string} workflowId - Workflow ID
 * @param {string} completedStepId - Step ID that was just completed
 * @returns {Promise<number>} Number of tasks created
 */
export const checkDependencyTasks = async (workflowId, completedStepId) => {
  try {
    let tasksCreated = 0;

    // Get workflow
    const workflowRef = doc(firestore, 'workflows', workflowId);
    const workflowDoc = await getDoc(workflowRef);
    readCounter.recordRead('get', 'workflows', 'checkDependencyTasks', 1);

    if (!workflowDoc.exists()) {
      return 0;
    }

    const workflow = workflowDoc.data();

    // Check if auto-create is enabled
    if (!workflow.autoCreateTasks) {
      return 0;
    }

    // Get workflow template
    const templateRef = doc(firestore, 'workflowTemplates', workflow.templateId);
    const templateDoc = await getDoc(templateRef);
    readCounter.recordRead('get', 'workflowTemplates', 'checkDependencyTasks', 1);

    if (!templateDoc.exists()) {
      return 0;
    }

    const template = templateDoc.data();

    // Find steps that depend on the completed step
    for (const step of template.steps) {
      const stepProgress = workflow.stepProgress[step.id];

      if (!stepProgress || stepProgress.taskCreated) {
        continue; // Task already created or no progress
      }

      // Read task creation trigger from stepProgress (includes overrides)
      const taskCreationTrigger = stepProgress.taskCreationTrigger || step.taskCreationTrigger || 'manual';

      if (taskCreationTrigger !== 'dependency') {
        continue; // Only check dependency-triggered steps
      }

      if (!step.dependencies || !step.dependencies.includes(completedStepId)) {
        continue; // This step doesn't depend on the completed step
      }

      // Check if ALL dependencies are completed
      const allDependenciesMet = step.dependencies.every(depId => {
        const depProgress = workflow.stepProgress[depId];
        return depProgress && depProgress.status === 'completed';
      });

      if (allDependenciesMet) {
        // All dependencies met, create task
        const taskId = await createTaskForWorkflowStep(workflow, workflowId, step, step.id);
        if (taskId) {
          tasksCreated++;
          secureLogger.debug('Created dependency-triggered task', {
            workflowId,
            stepId: step.id,
            taskId,
            completedStepId
          });
        }
      }
    }

    return tasksCreated;
  } catch (error) {
    secureLogger.error('Error checking dependency tasks', {
      workflowId,
      completedStepId,
      error: error.message
    });
    readCounter.recordError('workflows', 'checkDependencyTasks', error.message);
    throw error;
  }
};

/**
 * Sync task completion to workflow step
 * Called when a task is completed and has syncWithWorkflow enabled
 * @param {string} taskId - Task ID
 * @param {Object} task - Task data
 * @param {string} userId - User who completed the task
 */
export const syncTaskToWorkflowStep = async (taskId, task, userId) => {
  try {
    if (!task.workflowId || !task.workflowStepId || !task.syncWithWorkflow) {
      return; // Not a synced workflow task
    }

    const workflowRef = doc(firestore, 'workflows', task.workflowId);

    // Use transaction for conflict resolution
    await runTransaction(firestore, async (transaction) => {
      const workflowDoc = await transaction.get(workflowRef);
      readCounter.recordRead('get', 'workflows', 'syncTaskToWorkflowStep', 1);

      if (!workflowDoc.exists()) {
        secureLogger.warn('Workflow not found for task sync', {
          taskId,
          workflowId: task.workflowId
        });
        return;
      }

      const workflow = workflowDoc.data();
      const stepProgress = workflow.stepProgress?.[task.workflowStepId];

      if (!stepProgress) {
        secureLogger.warn('Step progress not found in workflow', {
          taskId,
          workflowId: task.workflowId,
          stepId: task.workflowStepId
        });
        return;
      }

      // Conflict resolution: check current state
      if (stepProgress.status === 'completed') {
        // Step already completed - check if it's newer than our update
        const existingCompletedAt = stepProgress.completedAt?.toMillis?.() || 0;
        const taskCompletedAt = task.completedAt?.toMillis?.() || Date.now();

        if (existingCompletedAt > taskCompletedAt) {
          secureLogger.info('Step already completed more recently, skipping sync', {
            taskId,
            workflowId: task.workflowId,
            stepId: task.workflowStepId,
            existingTime: new Date(existingCompletedAt).toISOString(),
            taskTime: new Date(taskCompletedAt).toISOString()
          });
          return;
        }
      }

      // Update workflow step to completed
      transaction.update(workflowRef, {
        [`stepProgress.${task.workflowStepId}.status`]: 'completed',
        [`stepProgress.${task.workflowStepId}.completedAt`]: Timestamp.now(),
        [`stepProgress.${task.workflowStepId}.completedBy`]: userId,
        [`stepProgress.${task.workflowStepId}.updatedAt`]: Timestamp.now()
      });

      secureLogger.debug('Synced task completion to workflow step', {
        taskId,
        workflowId: task.workflowId,
        stepId: task.workflowStepId
      });
    });

    // Check for dependent tasks after this step completes (outside transaction)
    await checkDependencyTasks(task.workflowId, task.workflowStepId);

  } catch (error) {
    secureLogger.error('Error syncing task to workflow step', {
      taskId,
      error: error.message
    });
    readCounter.recordError('workflows', 'syncTaskToWorkflowStep', error.message);
    // Don't throw - this is a background sync operation
  }
};

/**
 * Sync workflow step changes to linked task
 * Called when a workflow step is updated
 * @param {string} workflowId - Workflow ID
 * @param {string} stepId - Step ID
 * @param {Object} updates - Updates being made to step
 */
export const syncWorkflowStepToTask = async (workflowId, stepId, updates) => {
  try {
    // Get workflow to find linked task
    const workflowRef = doc(firestore, 'workflows', workflowId);
    const workflowDoc = await getDoc(workflowRef);
    readCounter.recordRead('get', 'workflows', 'syncWorkflowStepToTask', 1);

    if (!workflowDoc.exists()) {
      return;
    }

    const workflow = workflowDoc.data();
    const stepProgress = workflow.stepProgress[stepId];

    if (!stepProgress || !stepProgress.linkedTaskId) {
      return; // No linked task
    }

    const taskId = stepProgress.linkedTaskId;

    // Get current task state to check for conflicts
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskDoc = await getDoc(taskRef);
    readCounter.recordRead('get', 'tasks', 'syncWorkflowStepToTask', 1);

    if (!taskDoc.exists()) {
      secureLogger.warn('Linked task not found for workflow step sync', {
        workflowId,
        stepId,
        taskId
      });
      return;
    }

    const currentTask = taskDoc.data();
    const taskUpdates = {};

    // Sync assignee changes (only if task not manually reassigned)
    if (updates.assignedTo !== undefined) {
      // Only sync if task hasn't been updated more recently
      const stepUpdatedAt = stepProgress.updatedAt?.toMillis?.() || 0;
      const taskUpdatedAt = currentTask.updatedAt?.toMillis?.() || 0;

      if (stepUpdatedAt >= taskUpdatedAt) {
        taskUpdates.assignedTo = updates.assignedTo ? [updates.assignedTo] : [];
      } else {
        secureLogger.debug('Skipping assignee sync - task updated more recently', {
          workflowId,
          stepId,
          taskId
        });
      }
    }

    // Sync status changes (with conflict resolution)
    if (updates.status === 'completed') {
      // Only mark completed if not already completed by a different source
      if (currentTask.status !== 'completed' || !currentTask.completedBy) {
        taskUpdates.status = 'completed';
      }
    } else if (updates.status === 'in_progress') {
      // Only mark in_progress if not already completed
      if (currentTask.status !== 'completed') {
        taskUpdates.status = 'in_progress';
      }
    }

    // Only update if there are changes
    if (Object.keys(taskUpdates).length > 0) {
      try {
        await updateTask(taskId, taskUpdates);

        secureLogger.debug('Synced workflow step changes to task', {
          workflowId,
          stepId,
          taskId,
          updates: taskUpdates
        });
      } catch (updateError) {
        secureLogger.error('Failed to update task during sync', {
          workflowId,
          stepId,
          taskId,
          error: updateError.message
        });
      }
    }

  } catch (error) {
    secureLogger.error('Error syncing workflow step to task', {
      workflowId,
      stepId,
      error: error.message
    });
    readCounter.recordError('workflows', 'syncWorkflowStepToTask', error.message);
    // Don't throw - this is a background sync operation
  }
};

/**
 * Handle task deletion - break the sync link
 * @param {Object} task - Task being deleted
 */
export const handleTaskDeletion = async (task) => {
  try {
    if (!task.workflowId || !task.workflowStepId || !task.syncWithWorkflow) {
      return; // Not a synced workflow task
    }

    const workflowRef = doc(firestore, 'workflows', task.workflowId);

    // Break the link and reset taskCreated flag
    await updateDoc(workflowRef, {
      [`stepProgress.${task.workflowStepId}.linkedTaskId`]: null,
      [`stepProgress.${task.workflowStepId}.taskCreated`]: false,
      [`stepProgress.${task.workflowStepId}.updatedAt`]: Timestamp.now()
    });

    secureLogger.debug('Broke workflow-task sync link on task deletion', {
      taskId: task.id,
      workflowId: task.workflowId,
      stepId: task.workflowStepId
    });

  } catch (error) {
    secureLogger.error('Error handling task deletion sync', {
      taskId: task.id,
      error: error.message
    });
    // Don't throw - task is being deleted anyway
  }
};

export default {
  createTaskForWorkflowStep,
  checkImmediateTasks,
  checkTimelineTasks,
  checkDependencyTasks,
  syncTaskToWorkflowStep,
  syncWorkflowStepToTask,
  handleTaskDeletion
};
