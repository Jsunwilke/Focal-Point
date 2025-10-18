// src/utils/payrollCalculations.js
// Utilities for payroll and compensation calculations

/**
 * Calculate hours between two time strings
 * @param {string} startTime - Time in HH:MM format
 * @param {string} endTime - Time in HH:MM format
 * @returns {number} Hours as decimal (e.g., 8.5)
 */
export const calculateHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  const hours = (end - start) / (1000 * 60 * 60);

  return hours > 0 ? hours : 0;
};

/**
 * Get the start of the week for a given date (Sunday)
 * @param {string|Date} date - Date in YYYY-MM-DD format or Date object
 * @returns {Date} Start of week
 */
export const getWeekStart = (date) => {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday = 0
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

/**
 * Get the end of the week for a given date (Saturday)
 * @param {string|Date} date - Date in YYYY-MM-DD format or Date object
 * @returns {Date} End of week
 */
export const getWeekEnd = (date) => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

/**
 * Group time entries or sessions by week
 * @param {Array} entries - Array of entries with date property
 * @returns {Array} Array of weeks, each containing entries
 */
export const groupEntriesByWeek = (entries) => {
  const weeks = {};

  entries.forEach(entry => {
    const weekStart = getWeekStart(entry.date);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeks[weekKey]) {
      weeks[weekKey] = {
        weekStart: weekKey,
        entries: []
      };
    }

    weeks[weekKey].entries.push(entry);
  });

  return Object.values(weeks);
};

/**
 * Get number of pay periods per year based on pay period type
 * @param {string} payPeriodType - 'weekly', 'bi-weekly', 'semi-monthly', 'monthly'
 * @returns {number} Number of pay periods per year
 */
export const getPayPeriodsPerYear = (payPeriodType) => {
  switch (payPeriodType) {
    case 'weekly':
      return 52;
    case 'bi-weekly':
      return 26;
    case 'semi-monthly':
      return 24;
    case 'monthly':
      return 12;
    default:
      return 26; // Default to bi-weekly
  }
};

/**
 * Calculate cost for a single session/shift
 * This determines if the shift is overtime for salary+OT employees
 *
 * @param {Object} session - Session object with date, startTime, endTime, photographerId
 * @param {Object} employee - Employee object with compensation details
 * @param {Array} allSessionsInPeriod - All sessions in the period (for OT calculation)
 * @returns {Object} Cost breakdown for the session
 */
export const calculateSessionCost = (session, employee, allSessionsInPeriod = []) => {
  // DEBUG: Log inputs
  console.group('📊 calculateSessionCost');
  console.log('Session:', {
    date: session?.date,
    dateType: typeof session?.date,
    hasToDate: session?.date && typeof session?.date?.toDate === 'function',
    startTime: session?.startTime,
    endTime: session?.endTime,
    photographerId: session?.photographerId
  });
  console.log('Employee:', {
    id: employee?.id,
    name: employee?.displayName || `${employee?.firstName} ${employee?.lastName}`,
    compensationType: employee?.compensationType,
    hourlyRate: employee?.hourlyRate,
    overtimeThreshold: employee?.overtimeThreshold
  });
  console.log('All sessions in period (count):', allSessionsInPeriod?.length || 0);
  console.log('Session types in period:', allSessionsInPeriod?.map(s => ({
    date: s.date,
    dateType: typeof s.date,
    hasToDate: s.date && typeof s.date?.toDate === 'function',
    startTime: s.startTime,
    endTime: s.endTime
  })));

  if (!session || !employee) {
    console.log('❌ Missing session or employee - returning zero cost');
    console.groupEnd();
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  const sessionHours = calculateHours(session.startTime, session.endTime);
  console.log('Session hours:', sessionHours);

  // Hourly employees: simple calculation
  if (employee.compensationType === 'hourly') {
    const cost = sessionHours * (employee.hourlyRate || 0);
    const result = {
      hours: sessionHours,
      regularPay: cost,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: cost
    };
    console.log('💰 Hourly employee - returning:', result);
    console.groupEnd();
    return result;
  }

  // Salary employees: session cost is $0 (they get fixed amount regardless)
  if (employee.compensationType === 'salary') {
    const result = {
      hours: sessionHours,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0,
      note: 'Salaried - included in base pay'
    };
    console.log('💼 Salary employee - returning:', result);
    console.groupEnd();
    return result;
  }

  // Salary + OT employees: need to check weekly hours
  if (employee.compensationType === 'salary_with_overtime') {
    console.log('⏰ Salary+OT employee - calculating overtime');
    const threshold = employee.overtimeThreshold || 40;
    console.log('Overtime threshold:', threshold);

    // Get the week boundaries for this session
    const weekStart = getWeekStart(session.date);
    const weekEnd = getWeekEnd(session.date);
    console.log('Week boundaries:', {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString()
    });

    // Find all sessions this week for this employee BEFORE this session
    console.log('Filtering prior sessions this week...');
    const priorSessionsThisWeek = allSessionsInPeriod.filter(s => {
      if (s.photographerId !== employee.id) {
        console.log('  ❌ Skipping session - different photographer:', s.photographerId);
        return false;
      }
      if (!s.date) {
        console.log('  ❌ Skipping session - no date');
        return false;
      }

      // FIX: Handle Firestore Timestamps properly
      const sessionDate = typeof s.date === 'string'
        ? new Date(s.date + 'T00:00:00')
        : s.date && typeof s.date.toDate === 'function'
          ? s.date.toDate()
          : new Date(s.date);

      const currentSessionDate = typeof session.date === 'string'
        ? new Date(session.date + 'T00:00:00')
        : session.date && typeof session.date.toDate === 'function'
          ? session.date.toDate()
          : new Date(session.date);

      console.log('  📅 Checking session:', {
        rawDate: s.date,
        parsedDate: sessionDate.toISOString(),
        isValid: !isNaN(sessionDate.getTime()),
        currentSessionDate: currentSessionDate.toISOString(),
        inWeek: sessionDate >= weekStart && sessionDate <= weekEnd,
        beforeCurrent: sessionDate < currentSessionDate
      });

      // Include sessions in same week that are before this one
      const passes = sessionDate >= weekStart &&
             sessionDate <= weekEnd &&
             sessionDate < currentSessionDate;

      console.log(passes ? '  ✅ INCLUDED' : '  ❌ EXCLUDED');
      return passes;
    });

    console.log(`Found ${priorSessionsThisWeek.length} prior sessions this week`);

    // Calculate hours worked before this shift
    const hoursWorkedBeforeShift = priorSessionsThisWeek.reduce((sum, s) => {
      const sessionHrs = calculateHours(s.startTime, s.endTime);
      console.log(`  Prior session: ${s.startTime} - ${s.endTime} = ${sessionHrs} hours`);
      return sum + sessionHrs;
    }, 0);

    const hoursAfterShift = hoursWorkedBeforeShift + sessionHours;

    console.log('Hours calculation:', {
      hoursWorkedBeforeShift,
      sessionHours,
      hoursAfterShift,
      threshold,
      willBeOT: hoursAfterShift > threshold
    });

    // Determine OT status
    if (hoursWorkedBeforeShift >= threshold) {
      // Already in OT - entire shift is OT
      console.log('🔥 Already in OT - entire shift is overtime!');
      const overtimeCost = sessionHours * (employee.hourlyRate || 0);
      const result = {
        hours: sessionHours,
        regularPay: 0,
        overtimePay: overtimeCost,
        isOvertimeShift: true,
        overtimeHours: sessionHours,
        regularHours: 0,
        totalCost: overtimeCost,
        weeklyHoursBefore: hoursWorkedBeforeShift
      };
      console.log('Returning:', result);
      console.groupEnd();
      return result;
    } else if (hoursAfterShift > threshold) {
      // Shift crosses into OT
      console.log('⚠️ Shift crosses into OT');
      const regularHours = threshold - hoursWorkedBeforeShift;
      const overtimeHours = sessionHours - regularHours;
      const overtimeCost = overtimeHours * (employee.hourlyRate || 0);

      const result = {
        hours: sessionHours,
        regularPay: 0, // Regular hours covered by salary
        overtimePay: overtimeCost,
        isOvertimeShift: true,
        overtimeHours: overtimeHours,
        regularHours: regularHours,
        totalCost: overtimeCost,
        weeklyHoursBefore: hoursWorkedBeforeShift
      };
      console.log('Returning:', result);
      console.groupEnd();
      return result;
    } else {
      // Entirely within regular hours
      console.log('✅ Within regular hours - no overtime');
      const result = {
        hours: sessionHours,
        regularPay: 0,
        overtimePay: 0,
        isOvertimeShift: false,
        overtimeHours: 0,
        regularHours: sessionHours,
        totalCost: 0,
        note: 'Within salary threshold',
        weeklyHoursBefore: hoursWorkedBeforeShift
      };
      console.log('Returning:', result);
      console.groupEnd();
      return result;
    }
  }

  // Default fallback
  console.log('⚠️ Unknown compensation type - using default');
  const result = {
    hours: sessionHours,
    regularPay: 0,
    overtimePay: 0,
    isOvertimeShift: false,
    totalCost: 0
  };
  console.log('Returning:', result);
  console.groupEnd();
  return result;
};

/**
 * Calculate total payroll cost for an employee for a pay period
 * @param {Object} employee - Employee object with compensation details
 * @param {Array} timeEntries - Time entries for the employee in the period
 * @param {string} payPeriodType - Type of pay period
 * @returns {Object} Payroll breakdown
 */
export const calculateEmployeePayroll = (employee, timeEntries, payPeriodType = 'bi-weekly') => {
  if (!employee || !employee.compensationType) {
    return {
      wages: {
        regular: 0,
        overtime: 0,
        total: 0
      },
      hours: {
        regular: 0,
        overtime: 0,
        total: 0
      },
      mileage: 0,
      totalCost: 0
    };
  }

  let regularPay = 0;
  let overtimePay = 0;
  let regularHours = 0;
  let overtimeHours = 0;

  // Calculate total hours from time entries
  const totalHours = timeEntries.reduce((sum, entry) => {
    if (entry.clockInTime && entry.clockOutTime) {
      const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
      const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
      const hours = (clockOut - clockIn) / (1000 * 60 * 60);
      return sum + hours;
    }
    return sum;
  }, 0);

  // Hourly employees
  if (employee.compensationType === 'hourly') {
    regularPay = totalHours * (employee.hourlyRate || 0);
    regularHours = totalHours;
  }

  // Salary employees
  if (employee.compensationType === 'salary') {
    regularPay = (employee.salaryAmount || 0) / getPayPeriodsPerYear(payPeriodType);
    regularHours = totalHours; // Track hours for reporting, but doesn't affect pay
  }

  // Salary + OT employees
  if (employee.compensationType === 'salary_with_overtime') {
    // Base salary
    regularPay = (employee.salaryAmount || 0) / getPayPeriodsPerYear(payPeriodType);

    // Calculate OT using weekly breakdown
    const weeks = groupEntriesByWeek(timeEntries);
    const threshold = employee.overtimeThreshold || 40;

    weeks.forEach(week => {
      const weekHours = week.entries.reduce((sum, entry) => {
        if (entry.clockInTime && entry.clockOutTime) {
          const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
          const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);
          const hours = (clockOut - clockIn) / (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);

      if (weekHours > threshold) {
        const weekOT = weekHours - threshold;
        overtimeHours += weekOT;
        overtimePay += weekOT * (employee.hourlyRate || 0);
      }
    });

    regularHours = totalHours - overtimeHours;
  }

  const totalWages = regularPay + overtimePay;

  // Calculate mileage (will be added from actual mileage data elsewhere)
  const mileageCost = 0; // This should come from mileage tracking system

  return {
    wages: {
      regular: regularPay,
      overtime: overtimePay,
      total: totalWages
    },
    hours: {
      regular: regularHours,
      overtime: overtimeHours,
      total: totalHours
    },
    mileage: mileageCost,
    totalCost: totalWages + mileageCost
  };
};

/**
 * Format currency for display
 * @param {number} amount - Dollar amount
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Get number of weeks in a date range
 * @param {Object} dateRange - Object with start and end Date objects
 * @returns {number} Number of weeks (rounded up)
 */
export const getWeeksInRange = (dateRange) => {
  if (!dateRange || !dateRange.start || !dateRange.end) return 0;

  const start = dateRange.start instanceof Date ? dateRange.start : new Date(dateRange.start);
  const end = dateRange.end instanceof Date ? dateRange.end : new Date(dateRange.end);

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const weeks = Math.ceil(diffDays / 7);

  return weeks;
};
