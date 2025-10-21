// src/utils/sessionCostCalculations.js
// Utilities for calculating session costs (labor + mileage)

import { calculateDistance } from './calculations';
import { calculateSessionCost, calculateHours } from './payrollCalculations';

// Average driving speed for calculating drive time (in miles per hour)
const AVERAGE_DRIVING_SPEED_MPH = 42;

// Note: Using OSRM (free, open-source) instead of Google Maps for distance calculations
// Google Maps API key kept for potential future use
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Distance cache to avoid redundant API calls
const distanceCache = new Map();

// Rate limiting: track last API call time
let lastApiCallTime = 0;
const MIN_TIME_BETWEEN_CALLS = 100; // 100ms between calls = max 10 requests/second

/**
 * Generate cache key for distance between two coordinates
 * @param {Object} origin - { lat: number, lng: number }
 * @param {Object} destination - { lat: number, lng: number }
 * @param {string} unit - Distance unit
 * @returns {string} Cache key
 */
const getDistanceCacheKey = (origin, destination, unit) => {
  // Round coordinates to 4 decimal places (~11 meters precision) for cache key
  const lat1 = origin.lat.toFixed(4);
  const lng1 = origin.lng.toFixed(4);
  const lat2 = destination.lat.toFixed(4);
  const lng2 = destination.lng.toFixed(4);
  return `${lat1},${lng1}-${lat2},${lng2}-${unit}`;
};

/**
 * Wait for rate limit if needed
 * @returns {Promise<void>}
 */
const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;

  if (timeSinceLastCall < MIN_TIME_BETWEEN_CALLS) {
    const waitTime = MIN_TIME_BETWEEN_CALLS - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastApiCallTime = Date.now();
};

/**
 * Calculate driving distance between two GPS coordinates using OSRM (Open Source Routing Machine)
 * Falls back to straight-line distance (Haversine) if API fails or is unavailable
 * Includes caching and rate limiting to avoid overloading the public server
 * @param {Object} origin - { lat: number, lng: number }
 * @param {Object} destination - { lat: number, lng: number }
 * @param {string} unit - Distance unit ('miles' or 'km'), defaults to 'miles'
 * @returns {Promise<number>} Driving distance in specified unit
 */
const calculateDrivingDistance = async (origin, destination, unit = 'miles') => {
  try {
    // Check cache first
    const cacheKey = getDistanceCacheKey(origin, destination, unit);
    const cachedDistance = distanceCache.get(cacheKey);
    if (cachedDistance !== undefined) {
      return cachedDistance;
    }

    // Wait for rate limit before making API call (be nice to the public server)
    await waitForRateLimit();

    // OSRM Table API endpoint (public server)
    // Format: /table/v1/driving/{lon1},{lat1};{lon2},{lat2}
    // Note: OSRM uses lon,lat (not lat,lon!)
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/table/v1/driving/${coordinates}?annotations=distance`;

    // Make GET request to OSRM API with 3-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // OSRM API unavailable, use straight-line distance (this is normal and expected)
      const fallbackDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng, unit);

      // Cache fallback for errors to avoid retrying
      distanceCache.set(cacheKey, fallbackDistance);

      return fallbackDistance;
    }

    const data = await response.json();

    // Check if we got valid results
    // OSRM returns: { code: "Ok", distances: [[0, distance], [distance, 0]] }
    if (data && data.code === 'Ok' && data.distances && data.distances[0] && data.distances[0][1]) {
      const distanceInMeters = data.distances[0][1]; // Distance from origin to destination
      const distance = unit === 'miles'
        ? distanceInMeters * 0.000621371  // Convert meters to miles
        : distanceInMeters / 1000;         // Convert meters to kilometers

      // Cache the result
      distanceCache.set(cacheKey, distance);

      return distance;
    } else {
      // OSRM API returned invalid data, use straight-line distance
      const fallbackDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng, unit);

      // Cache fallback distance too (to avoid retrying failed API calls)
      distanceCache.set(cacheKey, fallbackDistance);

      return fallbackDistance;
    }

  } catch (error) {
    // Silently fall back to straight-line distance (OSRM may be blocked by CORS or network issues)
    // This is expected behavior and not an error - we have a reliable fallback
    const fallbackDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng, unit);

    // Cache fallback distance to avoid retrying failed routes
    const cacheKey = getDistanceCacheKey(origin, destination, unit);
    distanceCache.set(cacheKey, fallbackDistance);

    return fallbackDistance;
  }
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
 * Calculate round-trip distance from photographer home to school
 * Uses straight-line (Haversine) distance for reliability and speed
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

  // Use straight-line distance (fast and reliable)
  // Apply 1.4x multiplier to approximate actual driving distance
  const straightLineDistance = calculateDistance(
    homeCoords.lat,
    homeCoords.lng,
    schoolCoords.lat,
    schoolCoords.lng,
    unit
  );

  // Approximate driving distance = straight-line × 1.4
  const oneWayDistance = straightLineDistance * 1.4;

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
 * Calculate drive time based on distance
 * @param {number} distance - Round-trip distance in miles
 * @returns {number} Drive time in hours
 */
export const calculateDriveTime = (distance) => {
  if (!distance || distance <= 0) {
    return 0;
  }

  // Calculate drive time: distance / speed
  const driveTime = distance / AVERAGE_DRIVING_SPEED_MPH;

  // Round to 2 decimal places
  return Math.round(driveTime * 100) / 100;
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
 * @param {number} driveTime - Drive time in hours to add to session hours (default 0)
 * @returns {Object} Labor cost breakdown
 */
export const calculateSessionLaborCost = (session, photographer, allTimeEntriesInWeek = [], driveTime = 0) => {
  if (!session || !photographer) {
    return {
      hours: 0,
      regularPay: 0,
      overtimePay: 0,
      isOvertimeShift: false,
      totalCost: 0
    };
  }

  // Create extended session that includes drive time
  // We extend the end time by the drive time hours to get total billable hours
  let extendedSession = session;

  if (driveTime > 0) {
    // Calculate session hours
    const sessionHours = calculateHours(session.startTime, session.endTime);
    const totalHours = sessionHours + driveTime;

    // Convert total hours back to time format by extending end time
    const [startHour, startMin] = session.startTime.split(':').map(Number);
    const totalMinutes = totalHours * 60;
    const endMinutes = (startHour * 60 + startMin) + totalMinutes;
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMin = Math.round(endMinutes % 60);

    extendedSession = {
      ...session,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
    };
  }

  // Convert extended session to time entry format
  const sessionEntry = sessionToTimeEntry(extendedSession, photographer.id);
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
  const photographerEntries = allTimeEntriesInWeek
    .filter(entry => {
      const entryUserId = entry.userId || entry.photographerId;
      const isSamePhotographer = entryUserId === photographer.id;
      const isNotThisSession = entry.sessionId !== session.id;
      return isSamePhotographer && isNotThisSession;
    })
    .map(entry => timeEntryToSessionFormat(entry))  // Convert to session format for calculateSessionCost
    .filter(entry => entry !== null);  // Remove any failed conversions

  // Combine existing time entries with this session
  const allEntries = [...photographerEntries, sessionEntry];

  // Use existing payroll calculation (works with time entries)
  return calculateSessionCost(extendedSession, photographer, allEntries);
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
  // Calculate distance (using straight-line Haversine formula)
  const distance = calculateSessionDistance(photographer, school);

  // Calculate drive time from distance
  const driveTime = calculateDriveTime(distance);

  // Calculate mileage cost
  const mileageRate = photographer?.amountPerMile || 0;
  const mileageCost = calculateSessionMileageCost(distance, mileageRate);

  // Calculate labor cost (includes all time entries for accurate OT and drive time)
  const laborCostBreakdown = calculateSessionLaborCost(session, photographer, allTimeEntriesInWeek, driveTime);

  // Calculate session hours (at location only)
  const sessionHours = calculateHours(session.startTime, session.endTime);

  // Total billable hours = session hours + drive time
  const totalHours = sessionHours + driveTime;

  // Total cost
  const totalCost = laborCostBreakdown.totalCost + mileageCost;

  return {
    // Distance info
    distance,
    mileageRate,
    mileageCost,

    // Labor info
    hours: sessionHours,  // Hours at session location only
    driveTime,  // Drive time in hours
    totalHours,  // Total billable hours (session + drive)
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
