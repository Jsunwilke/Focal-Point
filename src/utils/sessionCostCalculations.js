// src/utils/sessionCostCalculations.js
// Utilities for calculating session costs (labor + mileage)

import { calculateDistance } from './calculations';
import { calculateSessionCost, calculateHours } from './payrollCalculations';

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
 * Calculate round-trip distance from photographer home to school
 * @param {Object} photographer - Photographer object with homeAddress (GPS coords)
 * @param {Object} school - School object with coordinates (GPS coords)
 * @param {string} unit - Distance unit ('miles' or 'km'), defaults to 'miles'
 * @returns {number} Round-trip distance, or 0 if coordinates unavailable
 */
export const calculateSessionDistance = (photographer, school, unit = 'miles') => {
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
export const calculateSessionMileageCost = (distance, mileageRate) => {
  if (!distance || !mileageRate) {
    return 0;
  }

  const cost = distance * mileageRate;

  // Round to 2 decimal places
  return Math.round(cost * 100) / 100;
};

/**
 * Convert session to time entry format for OT calculation
 * @param {Object} session - Session object
 * @param {string} photographerId - Photographer ID
 * @returns {Object} Time entry format compatible with payroll calculations
 */
const sessionToTimeEntry = (session, photographerId) => {
  if (!session || !session.date || !session.startTime || !session.endTime) {
    return null;
  }

  // Parse session date
  const sessionDate = typeof session.date === 'string'
    ? new Date(session.date + 'T00:00:00')
    : new Date(session.date);

  // Parse start time
  const [startHour, startMin] = session.startTime.split(':').map(Number);
  const clockIn = new Date(sessionDate);
  clockIn.setHours(startHour, startMin, 0, 0);

  // Parse end time
  const [endHour, endMin] = session.endTime.split(':').map(Number);
  const clockOut = new Date(sessionDate);
  clockOut.setHours(endHour, endMin, 0, 0);

  return {
    // For compatibility with both session-style and time-entry-style calculations
    userId: photographerId,
    photographerId: photographerId,
    date: sessionDate,

    // Time entry format (Date objects)
    clockInTime: clockIn,
    clockOutTime: clockOut,

    // Session format (strings) - needed for calculateSessionCost compatibility
    startTime: session.startTime,
    endTime: session.endTime,

    sessionId: session.id,
    isSession: true  // Flag to identify this as a session
  };
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

  // Convert Date objects to time strings (HH:MM format)
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
 * Calculate labor cost for a session using all time entries for accurate OT calculation
 * @param {Object} session - Session object with date, startTime, endTime
 * @param {Object} photographer - Photographer/employee object with compensation details
 * @param {Array} allTimeEntriesInWeek - All time entries for the week (for accurate OT calculation)
 * @returns {Object} Labor cost breakdown
 */
export const calculateSessionLaborCost = (session, photographer, allTimeEntriesInWeek = []) => {
  if (!session || !photographer) {
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  // Convert session to time entry format
  const sessionEntry = sessionToTimeEntry(session, photographer.id);
  if (!sessionEntry) {
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  // Filter AND CONVERT time entries for this photographer in this week (excluding this session)
  console.group('🔄 calculateSessionLaborCost - Processing time entries');
  console.log('Session:', {
    id: session.id,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime
  });
  console.log('Photographer:', {
    id: photographer.id,
    name: photographer.displayName || `${photographer.firstName} ${photographer.lastName}`
  });
  console.log('All time entries in week (count):', allTimeEntriesInWeek.length);

  const photographerEntries = allTimeEntriesInWeek
    .filter(entry => {
      const entryUserId = entry.userId || entry.photographerId;
      const isSamePhotographer = entryUserId === photographer.id;
      const isNotThisSession = entry.sessionId !== session.id;
      console.log('Time entry filter:', {
        entryUserId,
        isSamePhotographer,
        isNotThisSession,
        included: isSamePhotographer && isNotThisSession
      });
      return isSamePhotographer && isNotThisSession;
    })
    .map(entry => {
      const converted = timeEntryToSessionFormat(entry);
      console.log('Converted time entry:', {
        original: {
          clockInTime: entry.clockInTime,
          clockOutTime: entry.clockOutTime,
          date: entry.date
        },
        converted: {
          startTime: converted?.startTime,
          endTime: converted?.endTime,
          date: converted?.date
        }
      });
      return converted;
    })  // Convert to session format for calculateSessionCost
    .filter(entry => entry !== null);  // Remove any failed conversions

  console.log('Filtered photographer entries (count):', photographerEntries.length);

  // Combine existing time entries with this session
  const allEntries = [...photographerEntries, sessionEntry];
  console.log('Total entries for calculation (including current session):', allEntries.length);
  console.groupEnd();

  // Use existing payroll calculation (works with time entries)
  return calculateSessionCost(session, photographer, allEntries);
};

/**
 * Calculate total session cost (labor + mileage)
 * @param {Object} session - Session object
 * @param {Object} photographer - Photographer object
 * @param {Object} school - School object
 * @param {Array} allTimeEntriesInWeek - All time entries for the week (for accurate OT calculation)
 * @returns {Object} Complete cost breakdown
 */
export const calculateTotalSessionCost = (session, photographer, school, allTimeEntriesInWeek = []) => {
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
    totalCost: Math.round(totalCost * 100) / 100
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
 * Get compensation type display name
 * @param {string} compensationType - Type: 'hourly', 'salary', 'salary_with_overtime'
 * @returns {string} Display name
 */
export const getCompensationTypeDisplay = (compensationType) => {
  switch (compensationType) {
    case 'hourly':
      return 'Hourly';
    case 'salary':
      return 'Salary';
    case 'salary_with_overtime':
      return 'Salary + OT';
    default:
      return 'Unknown';
  }
};
