// functions/src/utils/costCalculations.js
// Server-side utilities for calculating session costs (labor + mileage)
// Ported from client-side src/utils/sessionCostCalculations.js and payrollCalculations.js

/**
 * Calculate hours between two time strings
 * @param {string} startTime - Time in HH:MM format
 * @param {string} endTime - Time in HH:MM format
 * @returns {number} Hours as decimal (e.g., 8.5)
 */
const calculateHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  const hours = (end - start) / (1000 * 60 * 60);

  return hours > 0 ? hours : 0;
};

/**
 * Get the start of the week for a given date (Sunday)
 * @param {string|Date|admin.firestore.Timestamp} date - Date in YYYY-MM-DD format, Date object, or Firestore Timestamp
 * @returns {Date} Start of week
 */
const getWeekStart = (date) => {
  // Handle Firestore Timestamp
  const d = date && typeof date.toDate === 'function'
    ? date.toDate()
    : typeof date === 'string'
      ? new Date(date + 'T00:00:00')
      : new Date(date);

  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday = 0
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

/**
 * Get the end of the week for a given date (Saturday)
 * @param {string|Date|admin.firestore.Timestamp} date - Date in YYYY-MM-DD format, Date object, or Firestore Timestamp
 * @returns {Date} End of week
 */
const getWeekEnd = (date) => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

/**
 * Parse GPS coordinates from string format "lat,lng"
 * @param {string} coordinateString - Coordinates in "lat,lng" format
 * @returns {Object|null} { lat: number, lng: number } or null if invalid
 */
const parseCoordinates = (coordinateString) => {
  if (!coordinateString || typeof coordinateString !== 'string') {
    return null;
  }

  const coords = coordinateString.split(',');
  if (coords.length !== 2) {
    return null;
  }

  const lat = parseFloat(coords[0].trim());
  const lng = parseFloat(coords[1].trim());

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  return { lat, lng };
};

/**
 * Haversine formula to calculate distance between two points
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @param {string} unit - Distance unit ('miles' or 'km'), defaults to 'miles'
 * @returns {number} Distance in specified unit
 */
const calculateDistance = (lat1, lon1, lat2, lon2, unit = 'miles') => {
  const R = unit === 'miles' ? 3959 : 6371; // Earth's radius in miles or kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate round-trip distance from photographer home to school
 * @param {Object} photographer - Photographer object with homeAddress (GPS coords)
 * @param {Object} school - School object with coordinates (GPS coords)
 * @param {string} unit - Distance unit ('miles' or 'km'), defaults to 'miles'
 * @returns {number} Round-trip distance, or 0 if coordinates unavailable
 */
const calculateSessionDistance = (photographer, school, unit = 'miles') => {
  if (!photographer || !school) {
    return 0;
  }

  // Parse photographer home coordinates
  const homeCoords = parseCoordinates(photographer.homeAddress);
  if (!homeCoords) {
    return 0;
  }

  // Parse school coordinates
  const schoolCoords = parseCoordinates(school.coordinates || school.schoolAddress);
  if (!schoolCoords) {
    return 0;
  }

  // Calculate one-way distance
  const oneWayDistance = calculateDistance(
    homeCoords.lat,
    homeCoords.lng,
    schoolCoords.lat,
    schoolCoords.lng,
    unit
  );

  // Round trip = 2x one-way
  const roundTripDistance = oneWayDistance * 2;

  // Round to 1 decimal place
  return Math.round(roundTripDistance * 10) / 10;
};

/**
 * Calculate mileage reimbursement cost
 * @param {number} distance - Distance in miles
 * @param {number} mileageRate - Rate per mile (e.g., 0.30 for $0.30/mile)
 * @returns {number} Mileage cost in dollars
 */
const calculateSessionMileageCost = (distance, mileageRate) => {
  if (!distance || !mileageRate) {
    return 0;
  }

  const cost = distance * mileageRate;

  // Round to 2 decimal places
  return Math.round(cost * 100) / 100;
};

/**
 * Convert time entry to session format for OT calculation
 * Time entries have clockInTime/clockOutTime (Date objects)
 * But calculateSessionCost expects startTime/endTime strings
 * @param {Object} entry - Time entry object with clockInTime/clockOutTime
 * @returns {Object|null} Session-format entry with startTime/endTime strings
 */
const timeEntryToSessionFormat = (entry) => {
  if (!entry || !entry.clockInTime || !entry.clockOutTime) {
    return null;
  }

  // Convert Firestore Timestamp or Date objects to time strings (HH:MM format)
  const clockIn = entry.clockInTime.toDate ? entry.clockInTime.toDate() : new Date(entry.clockInTime);
  const clockOut = entry.clockOutTime.toDate ? entry.clockOutTime.toDate() : new Date(entry.clockOutTime);

  const startTime = `${String(clockIn.getHours()).padStart(2, '0')}:${String(clockIn.getMinutes()).padStart(2, '0')}`;
  const endTime = `${String(clockOut.getHours()).padStart(2, '0')}:${String(clockOut.getMinutes()).padStart(2, '0')}`;

  return {
    ...entry,
    startTime,
    endTime,
    photographerId: entry.userId || entry.photographerId
  };
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
const calculateSessionCost = (session, employee, allSessionsInPeriod = []) => {
  if (!session || !employee) {
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  const sessionHours = calculateHours(session.startTime, session.endTime);

  // Hourly employees: simple calculation
  if (employee.compensationType === 'hourly') {
    const cost = sessionHours * (employee.hourlyRate || 0);
    return {
      hours: sessionHours,
      regularPay: cost,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: cost
    };
  }

  // Salary employees: session cost is $0 (they get fixed amount regardless)
  if (employee.compensationType === 'salary') {
    return {
      hours: sessionHours,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0,
      note: 'Salaried - included in base pay'
    };
  }

  // Salary + OT employees: need to check weekly hours
  if (employee.compensationType === 'salary_with_overtime') {
    const threshold = employee.overtimeThreshold || 40;

    // Get the week boundaries for this session
    const weekStart = getWeekStart(session.date);
    const weekEnd = getWeekEnd(session.date);

    // Find all sessions this week for this employee BEFORE this session
    const priorSessionsThisWeek = allSessionsInPeriod.filter(s => {
      if (s.photographerId !== employee.id) {
        return false;
      }
      if (!s.date) {
        return false;
      }

      // Handle Firestore Timestamps properly
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

      // Include sessions in same week that are before this one
      return sessionDate >= weekStart &&
             sessionDate <= weekEnd &&
             sessionDate < currentSessionDate;
    });

    // Calculate hours worked before this shift
    const hoursWorkedBeforeShift = priorSessionsThisWeek.reduce((sum, s) => {
      return sum + calculateHours(s.startTime, s.endTime);
    }, 0);

    const hoursAfterShift = hoursWorkedBeforeShift + sessionHours;

    // Determine OT status
    if (hoursWorkedBeforeShift >= threshold) {
      // Already in OT - entire shift is OT
      const overtimeCost = sessionHours * (employee.hourlyRate || 0);
      return {
        hours: sessionHours,
        regularPay: 0,
        overtimePay: overtimeCost,
        isOvertimeShift: true,
        overtimeHours: sessionHours,
        regularHours: 0,
        totalCost: overtimeCost,
        weeklyHoursBefore: hoursWorkedBeforeShift
      };
    } else if (hoursAfterShift > threshold) {
      // Shift crosses into OT
      const regularHours = threshold - hoursWorkedBeforeShift;
      const overtimeHours = sessionHours - regularHours;
      const overtimeCost = overtimeHours * (employee.hourlyRate || 0);

      return {
        hours: sessionHours,
        regularPay: 0, // Regular hours covered by salary
        overtimePay: overtimeCost,
        isOvertimeShift: true,
        overtimeHours: overtimeHours,
        regularHours: regularHours,
        totalCost: overtimeCost,
        weeklyHoursBefore: hoursWorkedBeforeShift
      };
    } else {
      // Entirely within regular hours
      return {
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
    }
  }

  // Default fallback
  return {
    hours: sessionHours,
    regularPay: 0,
    overtimePay: 0,
    isOvertimeShift: false,
    totalCost: 0
  };
};

/**
 * Calculate labor cost for a session using all time entries for accurate OT calculation
 * @param {Object} session - Session object with date, startTime, endTime
 * @param {Object} photographer - Photographer/employee object with compensation details
 * @param {Array} allTimeEntriesInWeek - All time entries for the week (for accurate OT calculation)
 * @returns {Object} Labor cost breakdown
 */
const calculateSessionLaborCost = (session, photographer, allTimeEntriesInWeek = []) => {
  if (!session || !photographer) {
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  // Filter AND CONVERT time entries for this photographer in this week (excluding this session)
  const photographerEntries = allTimeEntriesInWeek
    .filter(entry => {
      const entryUserId = entry.userId || entry.photographerId;
      const isSamePhotographer = entryUserId === photographer.id;
      const isNotThisSession = entry.sessionId !== session.id;
      return isSamePhotographer && isNotThisSession;
    })
    .map(entry => timeEntryToSessionFormat(entry))  // Convert to session format for calculateSessionCost
    .filter(entry => entry !== null);  // Remove any failed conversions

  // Use existing payroll calculation (works with time entries)
  return calculateSessionCost(session, photographer, photographerEntries);
};

/**
 * Calculate total session cost (labor + mileage)
 * @param {Object} session - Session object
 * @param {Object} photographer - Photographer object
 * @param {Object} school - School object
 * @param {Array} allTimeEntriesInWeek - All time entries for the week (for accurate OT calculation)
 * @returns {Object} Complete cost breakdown
 */
const calculateTotalSessionCost = (session, photographer, school, allTimeEntriesInWeek = []) => {
  // Calculate distance
  const distance = calculateSessionDistance(photographer, school);

  // Calculate mileage cost
  const mileageRate = photographer?.amountPerMile || 0;
  const mileageCost = calculateSessionMileageCost(distance, mileageRate);

  // Calculate labor cost (includes all time entries for accurate OT)
  const laborCostBreakdown = calculateSessionLaborCost(session, photographer, allTimeEntriesInWeek);

  // Calculate hours for display
  const hours = calculateHours(session.startTime, session.endTime);

  // Total cost
  const totalCost = laborCostBreakdown.totalCost + mileageCost;

  return {
    // Distance info
    distance,
    mileageRate,
    mileageCost,

    // Labor info
    hours,
    laborCost: laborCostBreakdown.totalCost,
    regularPay: laborCostBreakdown.regularPay,
    overtimePay: laborCostBreakdown.overtimePay,
    isOvertimeShift: laborCostBreakdown.isOvertimeShift,

    // Compensation info
    compensationType: photographer?.compensationType,
    hourlyRate: photographer?.hourlyRate,
    salaryAmount: photographer?.salaryAmount,

    // Total
    totalCost: Math.round(totalCost * 100) / 100,

    // Metadata
    calculatedAt: new Date().toISOString(),
    calculatedBy: 'server'
  };
};

module.exports = {
  calculateHours,
  getWeekStart,
  getWeekEnd,
  parseCoordinates,
  calculateDistance,
  calculateSessionDistance,
  calculateSessionMileageCost,
  calculateSessionCost,
  calculateSessionLaborCost,
  calculateTotalSessionCost
};
