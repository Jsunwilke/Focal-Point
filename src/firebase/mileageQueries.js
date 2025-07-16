// src/firebase/mileageQueries.js
// Mileage-specific queries and data processing functions

import { 
  getDailyJobReports, 
  getTeamMembers 
} from './firestore';
import { 
  getCurrentPayPeriod,
  getPreviousPayPeriod 
} from '../utils/payPeriods';

/**
 * Get comprehensive mileage data for a specific pay period
 * @param {string} organizationID - Organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Array<string>} userIds - Optional array of specific user IDs to include
 * @returns {Promise<Object>} Mileage data with employee summaries and details
 */
export const getMileageData = async (organizationID, startDate, endDate, userIds = null) => {
  try {
    // Get all daily job reports for the period
    const dailyReports = await getDailyJobReports(organizationID, startDate, endDate);
    
    // Get all team members to get their names and mileage rates
    const teamMembers = await getTeamMembers(organizationID);
    
    // Filter by specific users if provided
    const filteredReports = userIds 
      ? dailyReports.filter(report => userIds.includes(report.userId))
      : dailyReports;
    
    // Process the data
    const mileageSummary = generateMileageSummary(filteredReports, teamMembers, startDate, endDate);
    
    return {
      dailyReports: filteredReports,
      teamMembers,
      summary: mileageSummary,
      period: {
        startDate,
        endDate,
        label: `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`
      }
    };
  } catch (error) {
    console.error('Error fetching mileage data:', error);
    throw error;
  }
};

/**
 * Get mileage data for a specific pay period using organization's pay period settings
 * @param {string} organizationID - Organization ID
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {string} periodType - 'current', 'previous', or 'custom'
 * @param {Object} customDates - For custom periods: { startDate, endDate }
 * @param {Array<string>} userIds - Optional array of specific user IDs
 * @returns {Promise<Object>} Mileage data for the specified period
 */
export const getMileageDataForPeriod = async (
  organizationID, 
  payPeriodSettings, 
  periodType = 'current', 
  customDates = null,
  userIds = null
) => {
  let startDate, endDate, periodLabel;

  try {
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
        throw new Error(`Invalid period type: ${periodType}`);
    }

    // Get mileage data for the calculated period
    const mileageData = await getMileageData(organizationID, startDate, endDate, userIds);
    
    return {
      ...mileageData,
      period: {
        ...mileageData.period,
        label: periodLabel
      }
    };
  } catch (error) {
    console.error('Error fetching mileage data for period:', error);
    throw error;
  }
};

/**
 * Generate mileage summary for a set of daily reports and team members
 * @param {Array} dailyReports - Array of daily job reports
 * @param {Array} teamMembers - Array of team members with their rates
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 * @returns {Object} Mileage summary with totals and employee breakdowns
 */
export const generateMileageSummary = (dailyReports, teamMembers, startDate, endDate) => {
  const summary = {
    totalMiles: 0,
    totalCompensation: 0,
    totalJobs: 0,
    averageMilesPerJob: 0,
    employeeBreakdowns: [],
    periodStats: {
      startDate,
      endDate,
      totalDays: calculateDaysBetween(startDate, endDate)
    }
  };

  // Create a map of team members for quick lookup
  const teamMemberMap = {};
  teamMembers.forEach(member => {
    teamMemberMap[member.id] = member;
  });

  // Group reports by user
  const userReports = {};
  dailyReports.forEach(report => {
    // Skip reports without mileage data
    if (!report.totalMileage || report.totalMileage === 0) {
      return;
    }

    const userId = report.userId;
    const userName = report.yourName || 'Unknown';
    
    if (!userReports[userId]) {
      userReports[userId] = {
        userId,
        userName,
        reports: [],
        totalMiles: 0,
        totalJobs: 0,
        totalCompensation: 0,
        averageMilesPerJob: 0,
        mileageRate: 0
      };
    }

    userReports[userId].reports.push(report);
    userReports[userId].totalMiles += report.totalMileage || 0;
    userReports[userId].totalJobs += 1;
    
    // Update totals
    summary.totalMiles += report.totalMileage || 0;
    summary.totalJobs += 1;
  });

  // Calculate compensation and averages for each user
  Object.values(userReports).forEach(userSummary => {
    const teamMember = teamMemberMap[userSummary.userId];
    const mileageRate = teamMember?.amountPerMile || 0;
    
    userSummary.mileageRate = mileageRate;
    userSummary.totalCompensation = userSummary.totalMiles * mileageRate;
    userSummary.averageMilesPerJob = userSummary.totalJobs > 0 
      ? userSummary.totalMiles / userSummary.totalJobs 
      : 0;
    
    // Add to total compensation
    summary.totalCompensation += userSummary.totalCompensation;
    
    // Add to employee breakdowns
    summary.employeeBreakdowns.push(userSummary);
  });

  // Calculate overall averages
  summary.averageMilesPerJob = summary.totalJobs > 0 
    ? summary.totalMiles / summary.totalJobs 
    : 0;

  // Sort employee breakdowns by total miles (descending)
  summary.employeeBreakdowns.sort((a, b) => b.totalMiles - a.totalMiles);

  return summary;
};

/**
 * Get mileage data for a specific user
 * @param {string} organizationID - Organization ID
 * @param {string} userId - User ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} User-specific mileage data
 */
export const getUserMileageData = async (organizationID, userId, startDate, endDate) => {
  try {
    // Get mileage data for this specific user
    const mileageData = await getMileageData(organizationID, startDate, endDate, [userId]);
    
    // Return the user's specific data
    const userBreakdown = mileageData.summary.employeeBreakdowns.find(emp => emp.userId === userId);
    
    return {
      ...mileageData,
      userBreakdown: userBreakdown || {
        userId,
        userName: 'Unknown',
        reports: [],
        totalMiles: 0,
        totalJobs: 0,
        totalCompensation: 0,
        averageMilesPerJob: 0,
        mileageRate: 0
      }
    };
  } catch (error) {
    console.error('Error fetching user mileage data:', error);
    throw error;
  }
};

/**
 * Get mileage data for a specific user for a pay period
 * @param {string} organizationID - Organization ID
 * @param {string} userId - User ID
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {string} periodType - 'current', 'previous', or 'custom'
 * @param {Object} customDates - For custom periods: { startDate, endDate }
 * @returns {Promise<Object>} User-specific mileage data for the period
 */
export const getUserMileageDataForPeriod = async (
  organizationID, 
  userId, 
  payPeriodSettings, 
  periodType = 'current', 
  customDates = null
) => {
  try {
    const mileageData = await getMileageDataForPeriod(
      organizationID, 
      payPeriodSettings, 
      periodType, 
      customDates, 
      [userId]
    );
    
    // Return the user's specific data
    const userBreakdown = mileageData.summary.employeeBreakdowns.find(emp => emp.userId === userId);
    
    return {
      ...mileageData,
      userBreakdown: userBreakdown || {
        userId,
        userName: 'Unknown',
        reports: [],
        totalMiles: 0,
        totalJobs: 0,
        totalCompensation: 0,
        averageMilesPerJob: 0,
        mileageRate: 0
      }
    };
  } catch (error) {
    console.error('Error fetching user mileage data for period:', error);
    throw error;
  }
};

/**
 * Format date for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Calculate days between two dates
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number} Number of days between dates
 */
export const calculateDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end days
};

/**
 * Export mileage data to CSV format
 * @param {Object} mileageData - Mileage data object
 * @returns {string} CSV string
 */
export const exportMileageToCSV = (mileageData) => {
  const { summary, period } = mileageData;
  
  // Create CSV headers
  const headers = [
    'Employee Name',
    'Total Miles',
    'Total Jobs',
    'Average Miles per Job',
    'Mileage Rate',
    'Total Compensation'
  ];
  
  // Create CSV rows
  const rows = summary.employeeBreakdowns.map(employee => [
    employee.userName,
    employee.totalMiles.toFixed(2),
    employee.totalJobs,
    employee.averageMilesPerJob.toFixed(2),
    `$${employee.mileageRate.toFixed(2)}`,
    `$${employee.totalCompensation.toFixed(2)}`
  ]);
  
  // Add summary row
  rows.push([
    'TOTAL',
    summary.totalMiles.toFixed(2),
    summary.totalJobs,
    summary.averageMilesPerJob.toFixed(2),
    '',
    `$${summary.totalCompensation.toFixed(2)}`
  ]);
  
  // Combine headers and rows
  const csvData = [headers, ...rows];
  
  // Convert to CSV string
  return csvData.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
};