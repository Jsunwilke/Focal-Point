// src/services/workflowTaskService.js
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { createTask, updateTask } from '../firebase/tasks';
import { readCounter } from './readCounter';
import { secureLogger } from './secureLogger';

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

    // Create the task
    const task = await createTask(taskData);

    if (task && task.id) {
      // Update workflow step progress with task linkage
      const workflowRef = doc(firestore, 'workflows', workflowId);
      await updateDoc(workflowRef, {
        [`stepProgress.${stepId}.linkedTaskId`]: task.id,
        [`stepProgress.${stepId}.taskCreated`]: true,
        [`stepProgress.${stepId}.updatedAt`]: Timestamp.now()
      });

      secureLogger.debug('Auto-created task for workflow step', {
        workflowId,
        stepId,
        taskId: task.id,
        title: step.title
      });

      return task.id;
    }

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
              if (daysUntilDue <= threshold && daysUntilDue >= -30) { // Include overdue up to 30 days
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
    const workflowDoc = await getDoc(workflowRef);
    readCounter.recordRead('get', 'workflows', 'syncTaskToWorkflowStep', 1);

    if (!workflowDoc.exists()) {
      secureLogger.warn('Workflow not found for task sync', {
        taskId,
        workflowId: task.workflowId
      });
      return;
    }

    // Update workflow step to completed
    await updateDoc(workflowRef, {
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

    // Check for dependent tasks after this step completes
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
    const taskUpdates = {};

    // Sync assignee changes
    if (updates.assignedTo !== undefined) {
      taskUpdates.assignedTo = updates.assignedTo ? [updates.assignedTo] : [];
    }

    // Sync status changes
    if (updates.status === 'completed') {
      taskUpdates.status = 'completed';
    } else if (updates.status === 'in_progress') {
      taskUpdates.status = 'in_progress';
    }

    // Only update if there are changes
    if (Object.keys(taskUpdates).length > 0) {
      await updateTask(taskId, taskUpdates);

      secureLogger.debug('Synced workflow step changes to task', {
        workflowId,
        stepId,
        taskId,
        updates: taskUpdates
      });
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
  checkTimelineTasks,
  checkDependencyTasks,
  syncTaskToWorkflowStep,
  syncWorkflowStepToTask,
  handleTaskDeletion
};
