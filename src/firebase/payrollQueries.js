// src/firebase/payrollQueries.js
// Payroll-specific queries and data processing functions

import { 
  getAllTimeEntries, 
  getTimeEntries, 
  getTeamMembers, 
  calculateTotalHours,
  formatDuration 
} from './firestore';
import { 
  calculatePayPeriodBoundaries,
  getCurrentPayPeriod,
  getPreviousPayPeriod 
} from '../utils/payPeriods';

/**
 * Get comprehensive payroll data for a specific pay period
 * @param {string} organizationID - Organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Array<string>} userIds - Optional array of specific user IDs to include
 * @returns {Promise<Object>} Payroll data with employee summaries and details
 */
export const getPayrollData = async (organizationID, startDate, endDate, userIds = null) => {
  try {
    // Get all time entries for the period
    const timeEntries = await getAllTimeEntries(organizationID, startDate, endDate);
    
    // Get all team members
    const teamMembers = await getTeamMembers(organizationID);
    
    // Filter by specific users if provided
    const filteredEntries = userIds 
      ? timeEntries.filter(entry => userIds.includes(entry.userId))
      : timeEntries;
    
    // Get organization for overtime settings
    const { getOrganization, getSessions } = await import('./firestore');
    const organization = await getOrganization(organizationID);
    
    // Get sessions for the period to calculate attendance
    const sessions = await getSessions(organizationID, startDate, endDate);
    
    // Process the data with overtime settings and sessions
    const payrollSummary = generatePayrollSummary(
      filteredEntries, 
      teamMembers, 
      startDate, 
      endDate,
      organization?.overtimeSettings,
      sessions
    );
    
    return {
      timeEntries: filteredEntries,
      teamMembers,
      summary: payrollSummary,
      period: {
        startDate,
        endDate,
        label: `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`
      }
    };
  } catch (error) {
    console.error('Error fetching payroll data:', error);
    throw error;
  }
};

/**
 * Get payroll data for a specific pay period using organization's pay period settings
 * @param {string} organizationID - Organization ID
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {string} periodType - 'current', 'previous', 'custom', or 'historical-X'
 * @param {Object} customDates - For custom periods: { startDate, endDate }
 * @param {Array<string>} userIds - Optional array of specific user IDs
 * @param {Object} periodData - For historical periods: period object with startDate, endDate, label
 * @returns {Promise<Object>} Payroll data for the specified period
 */
export const getPayrollDataForPeriod = async (
  organizationID, 
  payPeriodSettings, 
  periodType = 'current', 
  customDates = null,
  userIds = null,
  periodData = null
) => {
  let startDate, endDate, periodLabel;

  try {
    if (periodType.startsWith('historical-')) {
      // Handle historical periods
      if (!periodData || !periodData.startDate || !periodData.endDate) {
        throw new Error('Period data is required for historical period type.');
      }
      startDate = periodData.startDate;
      endDate = periodData.endDate;
      periodLabel = `Historical Period: ${periodData.label || `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`}`;
    } else {
      switch (periodType) {
        case 'current':
          const currentPeriod = getCurrentPayPeriod(payPeriodSettings);
          if (!currentPeriod) {
            throw new Error('No current pay period found. Please check pay period settings.');
          }
          startDate = currentPeriod.start;
          endDate = currentPeriod.end;
          periodLabel = `Current Period: ${currentPeriod.label}`;
          break;

        case 'previous':
          const previousPeriod = getPreviousPayPeriod(payPeriodSettings);
          if (!previousPeriod) {
            throw new Error('No previous pay period found. Please check pay period settings.');
          }
          startDate = previousPeriod.start;
          endDate = previousPeriod.end;
          periodLabel = `Previous Period: ${previousPeriod.label}`;
          break;

        case 'custom':
          if (!customDates || !customDates.startDate || !customDates.endDate) {
            throw new Error('Custom date range is required for custom period type.');
          }
          startDate = customDates.startDate;
          endDate = customDates.endDate;
          periodLabel = `Custom Period: ${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
          break;

        default:
          throw new Error('Invalid period type. Must be "current", "previous", or "custom".');
      }
    }

    const payrollData = await getPayrollData(organizationID, startDate, endDate, userIds);
    
    return {
      ...payrollData,
      period: {
        ...payrollData.period,
        type: periodType,
        label: periodLabel
      }
    };
  } catch (error) {
    console.error('Error fetching payroll data for period:', error);
    throw error;
  }
};

/**
 * Generate comprehensive payroll summary from time entries and team members
 * @param {Array} timeEntries - Array of time entry objects
 * @param {Array} teamMembers - Array of team member objects
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 * @param {Object} overtimeSettings - Organization overtime settings (optional)
 * @param {Array} sessions - Array of session objects for attendance calculation (optional)
 * @returns {Object} Payroll summary with employee details and totals
 */
export const generatePayrollSummary = (timeEntries, teamMembers, startDate, endDate, overtimeSettings = null, sessions = []) => {
  const employeeSummaries = [];
  const organizationTotals = {
    totalHours: 0,
    totalEmployees: 0,
    employeesWithHours: 0,
    totalSessions: 0,
    avgHoursPerEmployee: 0
  };

  // Group time entries by user
  const entriesByUser = timeEntries.reduce((acc, entry) => {
    if (!acc[entry.userId]) {
      acc[entry.userId] = [];
    }
    acc[entry.userId].push(entry);
    return acc;
  }, {});

  // Process each team member
  teamMembers.forEach(member => {
    const userEntries = entriesByUser[member.id] || [];
    const totalHours = calculateTotalHours(userEntries);
    const completedEntries = userEntries.filter(entry => entry.status === 'clocked-out');
    const uniqueSessions = new Set(userEntries.map(entry => entry.sessionId).filter(Boolean));

    // Calculate attendance based on assigned sessions
    const assignedSessions = sessions.filter(session => {
      // Check if user is assigned to this session
      // Check both the photographerId field AND the composite ID pattern
      return session.photographerId === member.id || 
             (session.id && session.id.endsWith(`-${member.id}`));
    });
    
    // Get worked sessions (sessions with time entries)
    const workedSessionIds = new Set(userEntries.map(entry => entry.sessionId).filter(Boolean));
    const workedSessions = assignedSessions.filter(session => workedSessionIds.has(session.id));
    
    const attendance = {
      assigned: assignedSessions.length,
      worked: workedSessions.length,
      percentage: assignedSessions.length > 0 ? (workedSessions.length / assignedSessions.length) * 100 : 100
    };

    const employeeSummary = {
      employee: {
        id: member.id,
        name: member.displayName || `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        role: member.role,
        isActive: member.isActive
      },
      hours: {
        total: totalHours,
        formatted: formatDuration(totalHours),
        byDay: calculateDailyHours(userEntries, startDate, endDate),
        overtime: calculateOvertime(userEntries, startDate, endDate, overtimeSettings)
      },
      entries: {
        total: userEntries.length,
        completed: completedEntries.length,
        active: userEntries.length - completedEntries.length,
        sessions: uniqueSessions.size,
        details: userEntries.sort((a, b) => new Date(a.date) - new Date(b.date))
      },
      period: {
        startDate,
        endDate,
        workDays: getWorkDaysInPeriod(userEntries)
      },
      attendance: attendance
    };

    employeeSummaries.push(employeeSummary);

    // Update organization totals
    organizationTotals.totalHours += totalHours;
    if (totalHours > 0) {
      organizationTotals.employeesWithHours++;
    }
    organizationTotals.totalSessions += uniqueSessions.size;
  });

  organizationTotals.totalEmployees = teamMembers.length;
  organizationTotals.avgHoursPerEmployee = organizationTotals.totalEmployees > 0 
    ? organizationTotals.totalHours / organizationTotals.totalEmployees 
    : 0;

  // Sort employees by total hours (descending)
  employeeSummaries.sort((a, b) => b.hours.total - a.hours.total);

  return {
    employees: employeeSummaries,
    totals: {
      ...organizationTotals,
      formatted: {
        totalHours: formatDuration(organizationTotals.totalHours),
        avgHoursPerEmployee: formatDuration(organizationTotals.avgHoursPerEmployee)
      }
    },
    insights: generatePayrollInsights(employeeSummaries, organizationTotals)
  };
};

/**
 * Calculate daily hours breakdown for an employee
 * @param {Array} userEntries - Time entries for a specific user
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 * @returns {Object} Daily hours breakdown
 */
const calculateDailyHours = (userEntries, startDate, endDate) => {
  const dailyHours = {};
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Initialize all days in the period with 0 hours
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    dailyHours[dateStr] = {
      hours: 0,
      formatted: '0h 0m',
      entries: []
    };
  }

  // Calculate hours for each day
  userEntries.forEach(entry => {
    if (entry.date && entry.clockInTime && entry.clockOutTime) {
      const entryDate = entry.date;
      const clockIn = new Date(entry.clockInTime.seconds * 1000);
      const clockOut = new Date(entry.clockOutTime.seconds * 1000);
      const hours = (clockOut - clockIn) / (1000 * 60 * 60); // Convert to hours

      if (dailyHours[entryDate]) {
        dailyHours[entryDate].hours += hours;
        dailyHours[entryDate].formatted = formatDuration(dailyHours[entryDate].hours);
        dailyHours[entryDate].entries.push(entry);
      }
    }
  });

  return dailyHours;
};

/**
 * Calculate overtime hours for an employee based on organization settings
 * @param {Array} userEntries - Time entries for a specific user
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 * @param {Object} overtimeSettings - Organization overtime settings
 * @returns {Object} Overtime calculation
 */
const calculateOvertime = (userEntries, startDate, endDate, overtimeSettings = null) => {
  const dailyHours = calculateDailyHours(userEntries, startDate, endDate);
  
  // Use default settings if not provided
  const settings = overtimeSettings || {
    calculationMethod: 'daily',
    dailyThreshold: 8,
    weeklyThreshold: 40
  };
  
  let dailyOvertime = 0;
  let weeklyOvertime = 0;

  // Calculate daily overtime (over configured threshold per day)
  Object.values(dailyHours).forEach(day => {
    if (day.hours > settings.dailyThreshold) {
      dailyOvertime += day.hours - settings.dailyThreshold;
    }
  });

  // Calculate weekly overtime
  const totalHours = Object.values(dailyHours).reduce((sum, day) => sum + day.hours, 0);
  
  // Group entries by week for weekly overtime calculation
  if (settings.calculationMethod === 'weekly') {
    // For weekly calculation method, calculate overtime for the entire pay period
    // Most studios that use weekly overtime calculate it as total hours over 40 for the pay period
    if (totalHours > settings.weeklyThreshold) {
      weeklyOvertime = totalHours - settings.weeklyThreshold;
    }
  } else {
    // For daily method, still calculate weekly for informational purposes
    const periodDays = Object.keys(dailyHours).length;
    const periodWeeks = periodDays / 7;
    const regularHoursForPeriod = periodWeeks * settings.weeklyThreshold;

    if (totalHours > regularHoursForPeriod) {
      weeklyOvertime = totalHours - regularHoursForPeriod;
    }
  }

  // Determine which overtime to use based on calculation method
  const overtimeHours = settings.calculationMethod === 'weekly' ? weeklyOvertime : dailyOvertime;

  return {
    daily: {
      hours: dailyOvertime,
      formatted: formatDuration(dailyOvertime)
    },
    weekly: {
      hours: weeklyOvertime,
      formatted: formatDuration(weeklyOvertime)
    },
    total: {
      hours: overtimeHours,
      formatted: formatDuration(overtimeHours)
    },
    calculationMethod: settings.calculationMethod
  };
};

/**
 * Get unique work days for an employee in the period
 * @param {Array} userEntries - Time entries for a specific user
 * @returns {Array} Array of work dates
 */
const getWorkDaysInPeriod = (userEntries) => {
  const workDays = new Set();
  userEntries.forEach(entry => {
    if (entry.date && entry.clockInTime && entry.clockOutTime) {
      workDays.add(entry.date);
    }
  });
  return Array.from(workDays).sort();
};

/**
 * Generate insights and analytics for the payroll period
 * @param {Array} employeeSummaries - Array of employee summary objects
 * @param {Object} organizationTotals - Organization-level totals
 * @returns {Object} Payroll insights
 */
const generatePayrollInsights = (employeeSummaries, organizationTotals) => {
  const insights = {
    topPerformers: [],
    attendance: {
      perfect: 0,
      good: 0,
      needs_attention: 0
    },
    productivity: {
      above_average: 0,
      average: 0,
      below_average: 0
    },
    overtime: {
      employees_with_overtime: 0,
      total_overtime_hours: 0
    }
  };

  // Top 5 performers by hours
  insights.topPerformers = employeeSummaries
    .slice(0, 5)
    .map(emp => ({
      name: emp.employee.name,
      hours: emp.hours.formatted,
      sessions: emp.entries.sessions
    }));

  // Calculate insights
  employeeSummaries.forEach(emp => {
    // Attendance insights based on assigned sessions
    if (emp.attendance.percentage === 100) {
      insights.attendance.perfect++;
    } else if (emp.attendance.percentage >= 80) {
      insights.attendance.good++;
    } else {
      insights.attendance.needs_attention++;
    }

    // Productivity insights
    if (emp.hours.total > organizationTotals.avgHoursPerEmployee * 1.2) {
      insights.productivity.above_average++;
    } else if (emp.hours.total < organizationTotals.avgHoursPerEmployee * 0.8) {
      insights.productivity.below_average++;
    } else {
      insights.productivity.average++;
    }

    // Overtime insights
    if (emp.hours.overtime.total.hours > 0) {
      insights.overtime.employees_with_overtime++;
      insights.overtime.total_overtime_hours += emp.hours.overtime.total.hours;
    }
  });

  return insights;
};

/**
 * Get available pay periods for dropdown selection
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {number} count - Number of periods to generate (default: 6)
 * @returns {Array} Array of pay period options
 */
export const getAvailablePayPeriods = (payPeriodSettings, count = 6) => {
  if (!payPeriodSettings || !payPeriodSettings.isActive) {
    return [];
  }

  try {
    const periods = [];
    
    // Add current period
    const currentPeriod = getCurrentPayPeriod(payPeriodSettings);
    if (currentPeriod) {
      periods.push({
        value: 'current',
        label: `Current Period (${currentPeriod.label})`,
        startDate: currentPeriod.start,
        endDate: currentPeriod.end,
        isCurrent: true
      });
    }

    // Add previous period
    const previousPeriod = getPreviousPayPeriod(payPeriodSettings);
    if (previousPeriod) {
      periods.push({
        value: 'previous',
        label: `Previous Period (${previousPeriod.label})`,
        startDate: previousPeriod.start,
        endDate: previousPeriod.end,
        isPrevious: true
      });
    }

    // Generate additional historical periods
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - (count * 35)); // Go back enough to get the periods

    const allPeriods = calculatePayPeriodBoundaries(
      pastDate.toISOString().split('T')[0],
      today.toISOString().split('T')[0],
      payPeriodSettings
    );

    // Add recent historical periods (excluding current and previous which we already added)
    allPeriods
      .reverse() // Most recent first
      .slice(2, count) // Skip current and previous
      .forEach((period, index) => {
        periods.push({
          value: `historical-${index}`,
          label: period.label,
          startDate: period.start,
          endDate: period.end,
          isHistorical: true
        });
      });

    return periods;
  } catch (error) {
    console.error('Error generating pay periods:', error);
    return [];
  }
};

/**
 * Utility function to format date for display
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
const formatDateForDisplay = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};