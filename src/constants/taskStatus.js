// src/constants/taskStatus.js

/**
 * Task Status Constants
 *
 * Centralized definition of all valid task status values
 * to ensure consistency across the application.
 */

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

/**
 * Array of all valid status values for validation
 */
export const VALID_TASK_STATUSES = Object.values(TASK_STATUS);

/**
 * Status labels for display in UI
 */
export const TASK_STATUS_LABELS = {
  [TASK_STATUS.TODO]: 'To Do',
  [TASK_STATUS.IN_PROGRESS]: 'In Progress',
  [TASK_STATUS.ON_HOLD]: 'On Hold',
  [TASK_STATUS.COMPLETED]: 'Completed',
  [TASK_STATUS.CANCELLED]: 'Cancelled'
};

/**
 * Status colors for UI display
 */
export const TASK_STATUS_COLORS = {
  [TASK_STATUS.TODO]: '#3b82f6',      // Blue
  [TASK_STATUS.IN_PROGRESS]: '#f59e0b', // Amber
  [TASK_STATUS.ON_HOLD]: '#ef4444',   // Red
  [TASK_STATUS.COMPLETED]: '#10b981',  // Green
  [TASK_STATUS.CANCELLED]: '#6b7280'   // Gray
};

/**
 * Validate if a given status is valid
 * @param {string} status - Status to validate
 * @returns {boolean} - True if valid
 */
export const isValidTaskStatus = (status) => {
  return VALID_TASK_STATUSES.includes(status);
};

/**
 * Get display label for a status
 * @param {string} status - Status value
 * @returns {string} - Display label
 */
export const getTaskStatusLabel = (status) => {
  return TASK_STATUS_LABELS[status] || status;
};

/**
 * Get color for a status
 * @param {string} status - Status value
 * @returns {string} - Color hex code
 */
export const getTaskStatusColor = (status) => {
  return TASK_STATUS_COLORS[status] || '#6b7280';
};

/**
 * Statuses that are considered "active" (not finished)
 */
export const ACTIVE_STATUSES = [
  TASK_STATUS.TODO,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.ON_HOLD
];

/**
 * Statuses that are considered "finished"
 */
export const FINISHED_STATUSES = [
  TASK_STATUS.COMPLETED,
  TASK_STATUS.CANCELLED
];

/**
 * Check if status is active
 * @param {string} status - Status to check
 * @returns {boolean} - True if active
 */
export const isActiveStatus = (status) => {
  return ACTIVE_STATUSES.includes(status);
};

/**
 * Check if status is finished
 * @param {string} status - Status to check
 * @returns {boolean} - True if finished
 */
export const isFinishedStatus = (status) => {
  return FINISHED_STATUSES.includes(status);
};

export default {
  TASK_STATUS,
  VALID_TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  ACTIVE_STATUSES,
  FINISHED_STATUSES,
  isValidTaskStatus,
  getTaskStatusLabel,
  getTaskStatusColor,
  isActiveStatus,
  isFinishedStatus
};
