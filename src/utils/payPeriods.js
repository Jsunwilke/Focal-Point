// src/utils/payPeriods.js
// Pay period calculation utilities for timesheet and payroll management

/**
 * Pay Period Types and their configurations:
 * 
 * weekly: Every 7 days starting from a specific day of week
 * bi-weekly: Every 14 days starting from a specific reference date
 * semi-monthly: Twice monthly on specific dates (e.g., 1st & 15th)
 * monthly: Once monthly starting on a specific day of month
 */

export const PAY_PERIOD_TYPES = {
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi-weekly',
  SEMI_MONTHLY: 'semi-monthly',
  MONTHLY: 'monthly'
};

export const PAY_PERIOD_LABELS = {
  [PAY_PERIOD_TYPES.WEEKLY]: 'Weekly',
  [PAY_PERIOD_TYPES.BI_WEEKLY]: 'Bi-Weekly (Every 2 weeks)',
  [PAY_PERIOD_TYPES.SEMI_MONTHLY]: 'Semi-Monthly (Twice per month)',
  [PAY_PERIOD_TYPES.MONTHLY]: 'Monthly'
};

/**
 * Default pay period configurations
 */
export const DEFAULT_PAY_PERIOD_CONFIGS = {
  [PAY_PERIOD_TYPES.WEEKLY]: {
    dayOfWeek: 1 // Monday (0=Sunday, 1=Monday, etc.)
  },
  [PAY_PERIOD_TYPES.BI_WEEKLY]: {
    startDate: new Date().toISOString().split('T')[0] // Today's date as reference
  },
  [PAY_PERIOD_TYPES.SEMI_MONTHLY]: {
    firstDate: 1,   // 1st of month
    secondDate: 15  // 15th of month
  },
  [PAY_PERIOD_TYPES.MONTHLY]: {
    dayOfMonth: 1 // 1st of month
  }
};

/**
 * Validate pay period configuration
 * @param {string} type - Pay period type
 * @param {object} config - Configuration object
 * @returns {object} - { isValid: boolean, errors: string[] }
 */
export const validatePayPeriodConfig = (type, config) => {
  const errors = [];

  if (!type || !Object.values(PAY_PERIOD_TYPES).includes(type)) {
    errors.push('Invalid pay period type');
  }

  if (!config) {
    errors.push('Pay period configuration is required');
    return { isValid: false, errors };
  }

  switch (type) {
    case PAY_PERIOD_TYPES.WEEKLY:
      if (typeof config.dayOfWeek !== 'number' || config.dayOfWeek < 0 || config.dayOfWeek > 6) {
        errors.push('Day of week must be a number between 0 (Sunday) and 6 (Saturday)');
      }
      break;

    case PAY_PERIOD_TYPES.BI_WEEKLY:
      if (!config.startDate) {
        errors.push('Start date is required for bi-weekly pay periods');
      } else {
        const date = new Date(config.startDate);
        if (isNaN(date.getTime())) {
          errors.push('Invalid start date format');
        }
      }
      break;

    case PAY_PERIOD_TYPES.SEMI_MONTHLY:
      if (typeof config.firstDate !== 'number' || config.firstDate < 1 || config.firstDate > 31) {
        errors.push('First date must be between 1 and 31');
      }
      if (typeof config.secondDate !== 'number' || config.secondDate < 1 || config.secondDate > 31) {
        errors.push('Second date must be between 1 and 31');
      }
      if (config.firstDate === config.secondDate) {
        errors.push('First and second dates must be different');
      }
      break;

    case PAY_PERIOD_TYPES.MONTHLY:
      if (typeof config.dayOfMonth !== 'number' || config.dayOfMonth < 1 || config.dayOfMonth > 31) {
        errors.push('Day of month must be between 1 and 31');
      }
      break;

    default:
      errors.push('Unsupported pay period type');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Get the start of a week given a date and starting day of week
 * @param {Date} date - Reference date
 * @param {number} startDayOfWeek - Starting day of week (0=Sunday, 1=Monday, etc.)
 * @returns {Date} - Start of week
 */
const getWeekStart = (date, startDayOfWeek = 1) => {
  const result = new Date(date);
  const currentDay = result.getDay();
  const diff = (currentDay - startDayOfWeek + 7) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Calculate pay period boundaries for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {object} payPeriodSettings - Pay period configuration
 * @returns {Array} - Array of pay period objects with start and end dates
 */
export const calculatePayPeriodBoundaries = (startDate, endDate, payPeriodSettings) => {
  if (!payPeriodSettings || !payPeriodSettings.isActive) {
    // If no pay period settings, return the entire date range as one period
    return [{
      start: startDate,
      end: endDate,
      label: `${startDate} to ${endDate}`
    }];
  }

  const { type, config } = payPeriodSettings;
  const validation = validatePayPeriodConfig(type, config);
  
  if (!validation.isValid) {
    console.error('Invalid pay period configuration:', validation.errors);
    return [{
      start: startDate,
      end: endDate,
      label: `${startDate} to ${endDate}`
    }];
  }

  const periods = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  switch (type) {
    case PAY_PERIOD_TYPES.WEEKLY:
      generateWeeklyPeriods(start, end, config, periods);
      break;
    case PAY_PERIOD_TYPES.BI_WEEKLY:
      generateBiWeeklyPeriods(start, end, config, periods);
      break;
    case PAY_PERIOD_TYPES.SEMI_MONTHLY:
      generateSemiMonthlyPeriods(start, end, config, periods);
      break;
    case PAY_PERIOD_TYPES.MONTHLY:
      generateMonthlyPeriods(start, end, config, periods);
      break;
  }

  return periods;
};

/**
 * Generate weekly pay periods
 */
const generateWeeklyPeriods = (start, end, config, periods) => {
  let current = getWeekStart(start, config.dayOfWeek);
  
  while (current <= end) {
    const periodEnd = new Date(current);
    periodEnd.setDate(periodEnd.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);

    periods.push({
      start: formatDate(current),
      end: formatDate(periodEnd),
      label: `Week of ${formatDateForLabel(current)}`
    });

    current.setDate(current.getDate() + 7);
  }
};

/**
 * Generate bi-weekly pay periods
 */
const generateBiWeeklyPeriods = (start, end, config, periods) => {
  const referenceDate = new Date(config.startDate);
  referenceDate.setHours(0, 0, 0, 0); // Ensure we start at beginning of day
  
  // Calculate which bi-weekly period the start date falls into
  const daysDiff = Math.floor((start.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  const periodNumber = Math.floor(daysDiff / 14);
  
  // Find the start of the period that contains or comes before our start date
  let current = new Date(referenceDate);
  current.setDate(current.getDate() + (periodNumber * 14));
  current.setHours(0, 0, 0, 0);
  
  // If we're before our target start date, we need to go back one period
  if (current > start) {
    current.setDate(current.getDate() - 14);
  }
  
  // Generate periods
  while (current <= end) {
    const periodEnd = new Date(current);
    periodEnd.setDate(periodEnd.getDate() + 13); // 14 days total (0-13)
    periodEnd.setHours(23, 59, 59, 999);

    // Only include periods that overlap with our date range
    if (periodEnd >= start) {
      periods.push({
        start: formatDate(current),
        end: formatDate(periodEnd),
        label: `${formatDateForLabel(current)} - ${formatDateForLabel(periodEnd)}`
      });
    }

    // IMPORTANT: Start next period the day AFTER current period ends
    // This prevents dates from appearing in multiple periods
    current.setDate(current.getDate() + 14);
  }
};

/**
 * Generate semi-monthly pay periods
 */
const generateSemiMonthlyPeriods = (start, end, config, periods) => {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  for (let year = startYear; year <= endYear; year++) {
    const monthStart = year === startYear ? startMonth : 0;
    const monthEnd = year === endYear ? endMonth : 11;

    for (let month = monthStart; month <= monthEnd; month++) {
      // First period of the month
      const firstStart = new Date(year, month, config.firstDate);
      const firstEnd = new Date(year, month, config.secondDate - 1);
      firstEnd.setHours(23, 59, 59, 999);

      if (firstEnd >= start && firstStart <= end) {
        periods.push({
          start: formatDate(firstStart),
          end: formatDate(firstEnd),
          label: `${getMonthName(month)} ${config.firstDate}-${config.secondDate - 1}, ${year}`
        });
      }

      // Second period of the month
      const secondStart = new Date(year, month, config.secondDate);
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const secondEnd = new Date(year, month, lastDayOfMonth);
      secondEnd.setHours(23, 59, 59, 999);

      if (secondEnd >= start && secondStart <= end) {
        periods.push({
          start: formatDate(secondStart),
          end: formatDate(secondEnd),
          label: `${getMonthName(month)} ${config.secondDate}-${lastDayOfMonth}, ${year}`
        });
      }
    }
  }
};

/**
 * Generate monthly pay periods
 */
const generateMonthlyPeriods = (start, end, config, periods) => {
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  for (let year = startYear; year <= endYear; year++) {
    const monthStart = year === startYear ? startMonth : 0;
    const monthEnd = year === endYear ? endMonth : 11;

    for (let month = monthStart; month <= monthEnd; month++) {
      const periodStart = new Date(year, month, config.dayOfMonth);
      
      // If the day doesn't exist in this month (e.g., Feb 31), use last day
      if (periodStart.getMonth() !== month) {
        periodStart.setDate(0); // Go to last day of previous month
      }

      const periodEnd = new Date(year, month + 1, config.dayOfMonth - 1);
      
      // Handle month boundaries
      if (periodEnd.getDate() !== config.dayOfMonth - 1) {
        periodEnd.setDate(0); // Last day of the month
      }
      
      periodEnd.setHours(23, 59, 59, 999);

      if (periodEnd >= start && periodStart <= end) {
        periods.push({
          start: formatDate(periodStart),
          end: formatDate(periodEnd),
          label: `${getMonthName(month)} ${year} (${config.dayOfMonth}${getOrdinalSuffix(config.dayOfMonth)} to ${getOrdinalSuffix(config.dayOfMonth - 1 || new Date(year, month + 1, 0).getDate())})`
        });
      }
    }
  }
};

/**
 * Get the current pay period based on configuration
 * @param {object} payPeriodSettings - Pay period configuration
 * @returns {object} - Current pay period with start and end dates
 */
export const getCurrentPayPeriod = (payPeriodSettings) => {
  const today = new Date();
  const todayStr = formatDate(today);
  
  // Get a range that includes today
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 30); // Go back 30 days
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 30); // Go forward 30 days

  const periods = calculatePayPeriodBoundaries(
    formatDate(rangeStart),
    formatDate(rangeEnd),
    payPeriodSettings
  );

  // Validate periods don't overlap
  const validation = validatePayPeriodBoundaries(periods);
  if (!validation.isValid) {
  }

  // Find the period that includes today
  const currentPeriod = periods.find(period => period.start <= todayStr && period.end >= todayStr) || null;
  
  
  return currentPeriod;
};

/**
 * Get the previous pay period based on configuration
 * @param {object} payPeriodSettings - Pay period configuration
 * @returns {object} - Previous pay period with start and end dates
 */
export const getPreviousPayPeriod = (payPeriodSettings) => {
  const currentPeriod = getCurrentPayPeriod(payPeriodSettings);
  if (!currentPeriod) return null;

  const currentStart = new Date(currentPeriod.start);
  
  // Calculate the end of the previous period as one day before current period starts
  // This ensures no overlap between periods
  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999); // End at the very end of the previous day

  // Get a range that includes the previous period
  const rangeStart = new Date(previousEnd);
  rangeStart.setDate(rangeStart.getDate() - 60); // Go back 60 days to ensure we get the period

  const periods = calculatePayPeriodBoundaries(
    formatDate(rangeStart),
    formatDate(previousEnd),
    payPeriodSettings
  );

  // Find the period that ends exactly on our calculated previousEnd date
  // This ensures we get the period immediately before the current one
  const previousEndDateStr = formatDate(previousEnd);
  const previousPeriod = periods.find(period => period.end === previousEndDateStr);
  
  if (previousPeriod) {
    return previousPeriod;
  }

  // Fallback: Return the last period in the list (most recent before current)
  const fallbackPeriod = periods.length > 0 ? periods[periods.length - 1] : null;
  return fallbackPeriod;
};

/**
 * Validate that pay periods don't overlap
 * @param {Array} periods - Array of pay period objects
 * @returns {object} - { isValid: boolean, overlaps: Array }
 */
export const validatePayPeriodBoundaries = (periods) => {
  const overlaps = [];
  
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const period1 = periods[i];
      const period2 = periods[j];
      
      const start1 = new Date(period1.start);
      const end1 = new Date(period1.end);
      const start2 = new Date(period2.start);
      const end2 = new Date(period2.end);
      
      // Check if periods overlap
      const hasOverlap = (start1 <= end2 && end1 >= start2);
      
      if (hasOverlap) {
        overlaps.push({
          period1: period1,
          period2: period2,
          overlapType: 'date_range_overlap'
        });
      }
    }
  }
  
  return {
    isValid: overlaps.length === 0,
    overlaps: overlaps
  };
};

/**
 * Generate a preview of upcoming pay periods
 * @param {object} payPeriodSettings - Pay period configuration
 * @param {number} count - Number of periods to preview (default: 3)
 * @returns {Array} - Array of upcoming pay period objects
 */
export const generatePayPeriodPreview = (payPeriodSettings, count = 3) => {
  if (!payPeriodSettings || !payPeriodSettings.isActive) {
    return [];
  }

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + (count * 35)); // Approximate future range

  const periods = calculatePayPeriodBoundaries(
    formatDate(today),
    formatDate(futureDate),
    payPeriodSettings
  );

  return periods.slice(0, count);
};

/**
 * Utility functions
 */

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForLabel = (date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const getMonthName = (monthIndex) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthIndex];
};

const getOrdinalSuffix = (day) => {
  if (day > 3 && day < 21) return day + 'th';
  switch (day % 10) {
    case 1: return day + 'st';
    case 2: return day + 'nd';
    case 3: return day + 'rd';
    default: return day + 'th';
  }
};

/**
 * Helper function to get day names for UI
 */
export const getDayNames = () => [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

/**
 * Helper function to get month day options for UI
 */
export const getMonthDayOptions = () => {
  const options = [];
  for (let day = 1; day <= 31; day++) {
    options.push({
      value: day,
      label: getOrdinalSuffix(day)
    });
  }
  return options;
};