// src/utils/calendarUtils.js

/**
 * Calendar utility functions for date math and grid generation
 */

/**
 * Get the first day of the month
 */
export const getFirstDayOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Get the last day of the month
 */
export const getLastDayOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

/**
 * Get the number of days in a month
 */
export const getDaysInMonth = (date) => {
  return getLastDayOfMonth(date).getDate();
};

/**
 * Get the day of week (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeek = (date) => {
  return date.getDay();
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Check if date is today
 */
export const isToday = (date) => {
  return isSameDay(date, new Date());
};

/**
 * Check if date is in the past
 */
export const isPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

/**
 * Format date as "January 2025"
 */
export const formatMonthYear = (date) => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Format date as "Jan 15"
 */
export const formatMonthDay = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Get array of day names
 */
export const getDayNames = (short = false) => {
  if (short) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
};

/**
 * Get array of month names
 */
export const getMonthNames = (short = false) => {
  if (short) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
};

/**
 * Generate calendar grid for a month
 * Returns array of weeks, each week is array of days
 * Days outside the current month are included for complete grid
 */
export const generateCalendarGrid = (date) => {
  const firstDay = getFirstDayOfMonth(date);
  const lastDay = getLastDayOfMonth(date);
  const daysInMonth = getDaysInMonth(date);
  const startDayOfWeek = getDayOfWeek(firstDay);

  const grid = [];
  let week = [];

  // Add days from previous month to fill the first week
  const prevMonthLastDay = new Date(date.getFullYear(), date.getMonth(), 0);
  const prevMonthDays = prevMonthLastDay.getDate();

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    week.push({
      date: new Date(date.getFullYear(), date.getMonth() - 1, prevMonthDays - i),
      isCurrentMonth: false,
      isPreviousMonth: true,
      isNextMonth: false
    });
  }

  // Add days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(date.getFullYear(), date.getMonth(), day);

    week.push({
      date: currentDate,
      isCurrentMonth: true,
      isPreviousMonth: false,
      isNextMonth: false
    });

    // If week is complete, push it and start new week
    if (week.length === 7) {
      grid.push(week);
      week = [];
    }
  }

  // Add days from next month to fill the last week
  let nextMonthDay = 1;
  while (week.length < 7) {
    week.push({
      date: new Date(date.getFullYear(), date.getMonth() + 1, nextMonthDay),
      isCurrentMonth: false,
      isPreviousMonth: false,
      isNextMonth: true
    });
    nextMonthDay++;
  }

  if (week.length > 0) {
    grid.push(week);
  }

  return grid;
};

/**
 * Get tasks for a specific date
 */
export const getTasksForDate = (tasks, date) => {
  return tasks.filter(task => {
    if (!task.dueDate) return false;

    // Handle Firestore Timestamp
    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return isSameDay(dueDate, date);
  });
};

/**
 * Group tasks by date
 */
export const groupTasksByDate = (tasks) => {
  const grouped = {};

  tasks.forEach(task => {
    if (!task.dueDate) return;

    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const dateKey = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(task);
  });

  return grouped;
};

/**
 * Get date key for grouping (YYYY-MM-DD)
 */
export const getDateKey = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Navigate to previous month
 */
export const getPreviousMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
};

/**
 * Navigate to next month
 */
export const getNextMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
};

/**
 * Get start and end of week containing date
 */
export const getWeekBounds = (date) => {
  const dayOfWeek = getDayOfWeek(date);
  const start = new Date(date);
  start.setDate(date.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Get tasks for a week
 */
export const getTasksForWeek = (tasks, date) => {
  const { start, end } = getWeekBounds(date);

  return tasks.filter(task => {
    if (!task.dueDate) return false;

    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return dueDate >= start && dueDate <= end;
  });
};

/**
 * Convert Firestore Timestamp to Date
 */
export const firestoreToDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

export default {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getDaysInMonth,
  getDayOfWeek,
  isSameDay,
  isToday,
  isPast,
  formatMonthYear,
  formatMonthDay,
  getDayNames,
  getMonthNames,
  generateCalendarGrid,
  getTasksForDate,
  groupTasksByDate,
  getDateKey,
  getPreviousMonth,
  getNextMonth,
  getWeekBounds,
  getTasksForWeek,
  firestoreToDate
};
