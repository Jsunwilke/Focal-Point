// src/firebase/mileageQueries.js
// Mileage-specific queries and data processing functions

import { 
  getDailyJobReports, 
  getTeamMembers 
} from './firestore';
import { 
  getCurrentPayPeriod,
  getPreviousPayPeriod,
  calculatePayPeriodBoundaries 
} from '../utils/payPeriods';
// Removed mileageCacheService - filtering always runs fresh from daily reports cache
import { dailyJobReportsCacheService } from '../services/dailyJobReportsCacheService';
import { readCounter } from '../services/readCounter';
import dataCacheService from '../services/dataCacheService';

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Removed global tracking - no longer needed since we don't cache filtered results

/**
 * Helper function to preload daily reports cache for mileage calculations
 * Call this before accessing mileage data to ensure cache is available
 * @param {string} organizationID - Organization ID
 * @returns {Promise<boolean>} Whether cache was successfully loaded
 */
export const preloadDailyReportsForMileage = async (organizationID) => {
  try {
    const cachedData = dailyJobReportsCacheService.getCachedFullDataset(organizationID);
    if (cachedData && cachedData.reports) {
      console.log(`[Mileage] ✅ Daily reports cache already available (${cachedData.reports.length} reports)`);
      return true;
    }
    
    console.log(`[Mileage] ⏳ Daily reports cache not available, recommend loading Daily Reports page first`);
    return false;
  } catch (error) {
    console.error('[Mileage] Error checking daily reports cache:', error);
    return false;
  }
};

/**
 * Get comprehensive mileage data for a specific pay period using cached daily reports
 * @param {string} organizationID - Organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {Array<string>} userIds - Optional array of specific user IDs to include
 * @returns {Promise<Object>} Mileage data with employee summaries and details
 */
export const getMileageData = async (organizationID, startDate, endDate, userIds = null) => {
  try {
    // Debug: Log period details
    console.log(`[Mileage DEBUG] Loading data for period ${startDate} to ${endDate}`);
    
    // Debug: Log exact pay period boundaries
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0); // Start of day
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // End of day
    console.log(`[Mileage DEBUG] Pay period boundaries:`);
    console.log(`  Start: ${startDateObj.toISOString()} (${startDate})`);
    console.log(`  End: ${endDateObj.toISOString()} (${endDate})`);
    console.log(`  Period duration: ${Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24))} days`);
    console.log(`  Filtering rule: Dates >= ${startDate} AND <= ${endDate}`);
    
    // Special debug for July 26 issue
    if (endDate === '2025-07-26' || startDate === '2025-07-27') {
      console.log(`[Mileage DEBUG] ⚠️ BOUNDARY PERIOD DETECTED - Extra logging enabled`);
      console.log(`[Mileage DEBUG] This is the ${endDate === '2025-07-26' ? 'July 13-26' : 'July 27-Aug 9'} period`);
    }
    
    // Skip mileage cache - always filter from daily reports for consistency
    console.log(`[Mileage] 🔄 Generating mileage data for period ${startDate} to ${endDate}`);
    
    // First, try to get reports from the daily reports cache
    const cachedDailyReports = dailyJobReportsCacheService.getCachedFullDataset(organizationID);
    let dailyReports = [];
    
    if (cachedDailyReports && cachedDailyReports.reports) {
      console.log(`[Mileage] ✅ Using cached daily reports (${cachedDailyReports.reports.length} total reports)`);
      readCounter.recordCacheHit('dailyJobReports', 'getMileageData', cachedDailyReports.reports.length);
      
      // Filter reports by date range
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start at beginning of day
      const endDateObj = new Date(endDate);
      // IMPORTANT: Use exclusive end date to prevent boundary date from appearing in next period
      // For a period ending on July 26, we want to include July 26 23:59:59.999
      // but exclude July 27 00:00:00.000
      endDateObj.setHours(23, 59, 59, 999);
      
      console.log(`[Mileage] 📅 Date range filtering: ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);
      console.log(`[Mileage] 📅 Looking for reports between ${startDate} (inclusive) and ${endDate} (inclusive)`);
      console.log(`[Mileage] 📅 Boundary handling: Reports exactly on ${endDate} will be included ONLY in this period`);
      
      let dateFormatCounts = { validDates: 0, invalidDates: 0, missingDates: 0 };
      
      // Debug: Track report IDs to detect duplicates
      const seenReportIds = new Set();
      const duplicateReports = [];
      const boundaryDateReports = []; // Track reports on boundary dates
      
      dailyReports = cachedDailyReports.reports.filter((report, index) => {
        if (!report.date) {
          dateFormatCounts.missingDates++;
          return false;
        }
        
        // Removed report tracking - no longer needed since we don't cache filtered results
        
        // Debug: Check for duplicate report IDs
        if (report.id && seenReportIds.has(report.id)) {
          duplicateReports.push({
            id: report.id,
            date: report.date,
            index: index,
            userName: report.yourName || report.userId,
            mileage: report.totalMileage
          });
          console.warn(`[Mileage DEBUG] DUPLICATE REPORT detected: ID ${report.id} at index ${index}`);
        } else if (report.id) {
          seenReportIds.add(report.id);
        }
        
        // Robust date parsing for multiple formats
        let reportDate;
        try {
          if (report.date instanceof Date) {
            // Already a Date object (most common after cache deserialization)
            reportDate = new Date(report.date);
          } else if (typeof report.date === 'string') {
            // Old format: ISO string dates like "2025-02-08T00:00:00.000Z"
            reportDate = new Date(report.date);
            if (isNaN(reportDate.getTime())) {
              throw new Error('Invalid ISO date string');
            }
          } else if (report.date.toDate && typeof report.date.toDate === 'function') {
            // Firebase Timestamp object (live data)
            reportDate = report.date.toDate();
          } else if (typeof report.date === 'object' && report.date.seconds) {
            // Serialized Firebase Timestamp {seconds, nanoseconds}
            reportDate = new Date(report.date.seconds * 1000);
          } else {
            throw new Error(`Unknown date format: ${typeof report.date}`);
          }
          
          // Validate the resulting date
          if (isNaN(reportDate.getTime())) {
            throw new Error('Invalid date after conversion');
          }
          
          // CRITICAL: Normalize to start of day to ensure consistent date comparisons
          reportDate.setHours(0, 0, 0, 0);
          
          // Convert report date to YYYY-MM-DD string for comparison
          const reportDateStr = reportDate.toISOString().split('T')[0];
          
          // Use string comparison for dates (YYYY-MM-DD format sorts correctly)
          // This avoids all timezone conversion issues
          let isInRange = reportDateStr >= startDate && reportDateStr <= endDate;
          
          // Debug: Log the exact comparison being made for July 26
          if (reportDateStr.endsWith('-07-26')) {
            console.log(`[Mileage DEBUG] 🔍 July 26 comparison for period ${startDate} to ${endDate}:`);
            console.log(`  Report date: ${reportDateStr}`);
            console.log(`  Period start: ${startDate}`);
            console.log(`  Period end: ${endDate}`);
            console.log(`  String comparison: "${reportDateStr}" >= "${startDate}" && "${reportDateStr}" <= "${endDate}"`);
            console.log(`  In range? ${isInRange}`);
            console.log(`  Decision: ${isInRange ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
          }
          
          // Check if this is a boundary date
          const isBoundaryDate = reportDateStr === startDate || reportDateStr === endDate;
          
          // Debug logging for reports with mileage data and boundary cases
          if (report.totalMileage > 0 || index < 10 || !isInRange || isBoundaryDate) {
            const mileageInfo = report.totalMileage > 0 ? ` [${report.totalMileage} miles]` : '';
            const boundaryInfo = isBoundaryDate ? ' 🔸 BOUNDARY DATE' : '';
            console.log(`[Mileage DEBUG] Report ${index}: ${report.yourName || 'Unknown'} - Date ${reportDateStr}${mileageInfo} ${isInRange ? '✅ INCLUDED' : '❌ EXCLUDED'}${boundaryInfo} (range: ${startDate} to ${endDate})`);
            
            if (isBoundaryDate && isInRange) {
              boundaryDateReports.push({
                id: report.id,
                date: reportDateStr,
                userName: report.yourName || report.userId,
                mileage: report.totalMileage || 0
              });
            }
          }
          
          if (isInRange) {
            dateFormatCounts.validDates++;
          }
          
          return isInRange;
          
        } catch (error) {
          console.warn(`[Mileage] Report ${index}: Failed to parse date:`, report.date, error.message);
          dateFormatCounts.invalidDates++;
          return false;
        }
      });
      
      // Debug: Report duplicates found
      if (duplicateReports.length > 0) {
        console.warn(`[Mileage DEBUG] Found ${duplicateReports.length} duplicate reports:`, duplicateReports);
      }
      
      // Remove duplicates by ID to prevent same drive appearing in multiple pay periods
      const uniqueReports = [];
      const processedIds = new Set();
      const duplicateDetails = [];
      
      dailyReports.forEach((report, index) => {
        if (report.id && processedIds.has(report.id)) {
          // Collect detailed info about duplicates for debugging
          duplicateDetails.push({
            id: report.id,
            date: report.date,
            userName: report.yourName || report.userId || 'Unknown',
            mileage: report.totalMileage || 0,
            index: index
          });
          console.warn(`[Mileage DEBUG] DEDUPLICATION: Removing duplicate report ID ${report.id} (${report.yourName || 'Unknown'}, ${report.totalMileage || 0} miles, date: ${report.date})`);
          return; // Skip this duplicate
        }
        
        if (report.id) {
          processedIds.add(report.id);
        }
        
        uniqueReports.push(report);
      });
      
      const removedDuplicates = dailyReports.length - uniqueReports.length;
      if (removedDuplicates > 0) {
        console.log(`[Mileage DEBUG] Removed ${removedDuplicates} duplicate reports. ${uniqueReports.length} unique reports remaining.`);
        console.log(`[Mileage DEBUG] Duplicate details:`, duplicateDetails);
        
        // Additional warning if duplicates were found on boundary dates
        const boundaryDuplicates = duplicateDetails.filter(dup => {
          const dupDateStr = new Date(dup.date).toISOString().split('T')[0];
          return dupDateStr === startDate || dupDateStr === endDate;
        });
        
        if (boundaryDuplicates.length > 0) {
          console.warn(`[Mileage DEBUG] ⚠️ Found ${boundaryDuplicates.length} duplicates on boundary dates!`, boundaryDuplicates);
        }
        
        dailyReports = uniqueReports;
      }
      
      console.log(`[Mileage] Date filtering results: ${dateFormatCounts.validDates} valid dates, ${dateFormatCounts.invalidDates} invalid dates, ${dateFormatCounts.missingDates} missing dates`);
      
      // Log boundary date reports if any
      if (boundaryDateReports.length > 0) {
        console.log(`[Mileage] 🔸 Boundary date reports (${boundaryDateReports.length} total):`, boundaryDateReports);
        
        // Additional validation: Check if any boundary dates might cause issues
        boundaryDateReports.forEach(report => {
          if (report.date === endDate) {
            console.log(`[Mileage VALIDATION] ✅ Report on ${report.date} correctly included in period ending ${endDate}`);
          } else if (report.date === startDate) {
            console.log(`[Mileage VALIDATION] ✅ Report on ${report.date} correctly included in period starting ${startDate}`);
          }
        });
      }
      
      // Final validation: Log date distribution
      const dateDistribution = {};
      dailyReports.forEach(report => {
        const dateStr = new Date(report.date).toISOString().split('T')[0];
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      });
      
      console.log(`[Mileage] ✅ Filtered ${dailyReports.length} reports for date range ${startDate} to ${endDate}`);
      console.log(`[Mileage] 📊 Date distribution:`, Object.keys(dateDistribution).sort().map(date => 
        `${date}: ${dateDistribution[date]} reports`
      ).join(', '));
    } else {
      console.log(`[Mileage] ❌ No cached daily reports found. Loading from Firestore...`);
      readCounter.recordCacheMiss('dailyJobReports', 'getMileageData');
      
      // Load reports directly from Firestore
      try {
        const { subscribeToDailyJobReports } = await import('./firestore');
        
        // Create a promise to handle the async data loading
        dailyReports = await new Promise((resolve, reject) => {
          console.log(`[Mileage] 📥 Loading all daily reports from Firestore for organization ${organizationID}`);
          
          const unsubscribe = subscribeToDailyJobReports(
            organizationID,
            (reportsData, metadata) => {
              console.log(`[Mileage] ✅ Loaded ${reportsData.length} reports from Firestore`);
              
              // Cache the data for future use
              dailyJobReportsCacheService.setCachedFullDataset(organizationID, reportsData);
              
              // Filter by date range
              const filteredByDate = reportsData.filter(report => {
                if (!report.date) return false;
                
                try {
                  let reportDate;
                  if (report.date instanceof Date) {
                    reportDate = new Date(report.date);
                  } else if (typeof report.date === 'string') {
                    reportDate = new Date(report.date);
                  } else if (report.date.toDate && typeof report.date.toDate === 'function') {
                    reportDate = report.date.toDate();
                  } else if (typeof report.date === 'object' && report.date.seconds) {
                    reportDate = new Date(report.date.seconds * 1000);
                  } else {
                    return false;
                  }
                  
                  // Normalize to start of day
                  reportDate.setHours(0, 0, 0, 0);
                  
                  // Use string comparison for consistency with cache filtering
                  const reportDateStr = reportDate.toISOString().split('T')[0];
                  
                  return reportDateStr >= startDate && reportDateStr <= endDate;
                } catch (error) {
                  console.warn(`[Mileage] Failed to parse date for report:`, report.date);
                  return false;
                }
              });
              
              // Unsubscribe immediately after getting data
              unsubscribe();
              
              resolve(filteredByDate);
            },
            (error) => {
              console.error(`[Mileage] Error loading reports from Firestore:`, error);
              unsubscribe();
              reject(error);
            }
          );
        });
        
        console.log(`[Mileage] ✅ Filtered ${dailyReports.length} reports for date range ${startDate} to ${endDate}`);
      } catch (error) {
        console.error(`[Mileage] ❌ Failed to load reports from Firestore:`, error);
        throw new Error('Failed to load daily reports. Please try again or contact support.');
      }
    }
    
    // Get all team members to get their names and mileage rates - check cache first
    let teamMembers = [];
    const cachedUsers = dataCacheService.getCachedUsers(organizationID);
    if (cachedUsers && cachedUsers.length > 0) {
      console.log('[MileageQueries] Using cached users:', cachedUsers.length, 'users');
      readCounter.recordCacheHit('users', 'MileageQueries', cachedUsers.length);
      teamMembers = cachedUsers;
    } else {
      console.log('[MileageQueries] No cached users, fetching from Firebase');
      readCounter.recordCacheMiss('users', 'MileageQueries');
      teamMembers = await getTeamMembers(organizationID);
    }
    
    // Filter by specific users if provided
    const filteredReports = userIds 
      ? dailyReports.filter(report => userIds.includes(report.userId))
      : dailyReports;
    
    // Debug: Comprehensive analysis of filtered reports
    let reportsWithMileage = 0;
    let totalMileageFound = 0;
    let dateFormatAnalysis = { validDates: 0, invalidDates: 0, dateFormats: {} };
    
    console.log(`[Mileage] 🔍 Analyzing ${filteredReports.length} filtered reports for mileage data...`);
    
    filteredReports.forEach((report, index) => {
      // Analyze date format
      let dateFormat = 'unknown';
      if (report.date) {
        if (report.date instanceof Date) {
          dateFormat = 'Date object';
          dateFormatAnalysis.validDates++;
        } else if (typeof report.date === 'string') {
          if (report.date.includes(' at ')) {
            dateFormat = 'Firebase display string';
          } else if (report.date.match(/^\d{4}-\d{2}-\d{2}T/)) {
            dateFormat = 'ISO string';
          } else {
            dateFormat = 'Other string';
          }
          dateFormatAnalysis.validDates++;
        } else if (typeof report.date === 'object' && report.date.seconds) {
          dateFormat = 'Timestamp object';
          dateFormatAnalysis.validDates++;
        } else {
          dateFormat = `Unknown (${typeof report.date})`;
          dateFormatAnalysis.invalidDates++;
        }
      } else {
        dateFormat = 'Missing date';
        dateFormatAnalysis.invalidDates++;
      }
      
      dateFormatAnalysis.dateFormats[dateFormat] = (dateFormatAnalysis.dateFormats[dateFormat] || 0) + 1;
      
      // Check for mileage data
      if (report.totalMileage && report.totalMileage > 0) {
        reportsWithMileage++;
        totalMileageFound += report.totalMileage;
        console.log(`[Mileage] ✅ Report ${index}: ${report.yourName || report.userId} - ${report.totalMileage} miles on ${report.date?.toISOString?.() || report.date} (${dateFormat})`);
      } else if (index < 5) {
        // Log first few reports without mileage for debugging
        console.log(`[Mileage] ❌ Report ${index}: ${report.yourName || report.userId} - NO MILEAGE (totalMileage: ${report.totalMileage}) on ${report.date?.toISOString?.() || report.date} (${dateFormat})`);
      }
    });
    
    console.log(`[Mileage] 📊 Date format analysis:`, dateFormatAnalysis.dateFormats);
    console.log(`[Mileage] 📊 Found ${reportsWithMileage} reports with mileage data (${totalMileageFound} total miles) out of ${filteredReports.length} filtered reports`);

    // Process the data
    const mileageSummary = generateMileageSummary(filteredReports, teamMembers, startDate, endDate);
    
    const mileageData = {
      dailyReports: filteredReports,
      teamMembers,
      summary: mileageSummary,
      period: {
        startDate,
        endDate,
        label: `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`
      }
    };
    
    // Debug: Final summary before caching
    console.log(`[Mileage DEBUG] Final mileage data summary for ${startDate} to ${endDate}:`);
    console.log(`  Reports processed: ${filteredReports.length}`);
    console.log(`  Reports with mileage: ${reportsWithMileage}`);
    console.log(`  Total miles: ${mileageData.summary.totalMiles}`);
    console.log(`  Total jobs: ${mileageData.summary.totalJobs}`);
    console.log(`  Employee breakdowns: ${mileageData.summary.employeeBreakdowns.length}`);
    
    // Skip caching filtered results - always filter fresh from daily reports
    console.log(`[Mileage] ✅ Generated mileage data for period ${startDate} to ${endDate} (not cached)`);
    
    return mileageData;
  } catch (error) {
    console.error('Error fetching mileage data:', error);
    throw error;
  }
};

/**
 * Validate that a date doesn't appear in multiple pay periods
 * @param {string} organizationID - Organization ID
 * @param {Object} payPeriodSettings - Pay period settings
 * @param {string} targetDate - Date to check (YYYY-MM-DD format)
 * @returns {Promise<Object>} Validation result with period info
 */
const validateDateInSinglePeriod = async (organizationID, payPeriodSettings, targetDate) => {
  try {
    // Get a range of periods around the target date
    const checkDate = new Date(targetDate);
    const rangeStart = new Date(checkDate);
    rangeStart.setDate(rangeStart.getDate() - 30);
    const rangeEnd = new Date(checkDate);
    rangeEnd.setDate(rangeEnd.getDate() + 30);
    
    const periods = calculatePayPeriodBoundaries(
      formatDate(rangeStart),
      formatDate(rangeEnd),
      payPeriodSettings
    );
    
    // Find all periods that include this date
    const periodsContainingDate = periods.filter(period => {
      return targetDate >= period.start && targetDate <= period.end;
    });
    
    if (periodsContainingDate.length > 1) {
      console.warn(`[Mileage VALIDATION] ⚠️ Date ${targetDate} appears in ${periodsContainingDate.length} pay periods:`, 
        periodsContainingDate.map(p => `${p.start} to ${p.end}`));
    }
    
    return {
      isValid: periodsContainingDate.length === 1,
      date: targetDate,
      periodsFound: periodsContainingDate.length,
      periods: periodsContainingDate
    };
  } catch (error) {
    console.error('[Mileage VALIDATION] Error validating date:', error);
    return { isValid: false, error: error.message };
  }
};

/**
 * Get mileage data for a specific pay period using organization's pay period settings
 * @param {string} organizationID - Organization ID
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {string} periodType - 'current', 'previous', 'custom', or 'historical-X'
 * @param {Object} customDates - For custom periods: { startDate, endDate }
 * @param {Array<string>} userIds - Optional array of specific user IDs
 * @param {Object} periodData - For historical periods: period object with startDate, endDate, label
 * @returns {Promise<Object>} Mileage data for the specified period
 */
export const getMileageDataForPeriod = async (
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
          throw new Error(`Invalid period type: ${periodType}`);
      }
    }

    // Validate boundary dates before fetching data
    console.log(`[Mileage] 🔍 Validating pay period boundaries for ${startDate} to ${endDate}`);
    const startValidation = await validateDateInSinglePeriod(organizationID, payPeriodSettings, startDate);
    const endValidation = await validateDateInSinglePeriod(organizationID, payPeriodSettings, endDate);
    
    if (!startValidation.isValid) {
      console.warn(`[Mileage] ⚠️ Start date ${startDate} appears in ${startValidation.periodsFound} periods!`);
    }
    if (!endValidation.isValid) {
      console.warn(`[Mileage] ⚠️ End date ${endDate} appears in ${endValidation.periodsFound} periods!`);
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
  let skippedReports = 0;
  let processedReports = 0;
  
  console.log(`[generateMileageSummary] Processing ${dailyReports.length} reports for period ${startDate} to ${endDate}`);
  
  dailyReports.forEach((report, index) => {
    // Skip reports without mileage data
    if (!report.totalMileage || report.totalMileage === 0) {
      skippedReports++;
      if (index < 5) { // Log first few skipped reports for debugging
        console.log(`[generateMileageSummary] Skipped report ${index}: totalMileage = ${report.totalMileage}, user = ${report.yourName || report.userId}`);
      }
      return;
    }

    processedReports++;
    const userId = report.userId;
    const userName = report.yourName || 'Unknown';
    
    console.log(`[generateMileageSummary] Processing report ${index}: ${userName} - ${report.totalMileage} miles`);
    
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

  console.log(`[generateMileageSummary] Summary: ${processedReports} processed, ${skippedReports} skipped. Total: ${summary.totalMiles} miles, ${summary.totalJobs} jobs, $${summary.totalCompensation.toFixed(2)} compensation`);

  // Calculate overall averages
  summary.averageMilesPerJob = summary.totalJobs > 0 
    ? summary.totalMiles / summary.totalJobs 
    : 0;

  // Sort employee breakdowns by total miles (descending)
  summary.employeeBreakdowns.sort((a, b) => b.totalMiles - a.totalMiles);

  // Sort each employee's reports by date (most recent first)
  summary.employeeBreakdowns.forEach(employee => {
    if (employee.reports) {
      employee.reports.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
    }
  });

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

// Removed resetMileageTracking - no longer needed since we don't cache filtered results

/**
 * Get mileage data for a specific user for a pay period
 * @param {string} organizationID - Organization ID
 * @param {string} userId - User ID
 * @param {Object} payPeriodSettings - Organization's pay period configuration
 * @param {string} periodType - 'current', 'previous', 'custom', or 'historical-X'
 * @param {Object} customDates - For custom periods: { startDate, endDate }
 * @param {Object} periodData - For historical periods: period object with startDate, endDate, label
 * @returns {Promise<Object>} User-specific mileage data for the period
 */
export const getUserMileageDataForPeriod = async (
  organizationID, 
  userId, 
  payPeriodSettings, 
  periodType = 'current', 
  customDates = null,
  periodData = null
) => {
  try {
    const mileageData = await getMileageDataForPeriod(
      organizationID, 
      payPeriodSettings, 
      periodType, 
      customDates, 
      [userId],
      periodData
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
 * Get user mileage data for the current month
 * @param {string} organizationID - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User-specific mileage data for current month
 */
export const getUserMileageDataForCurrentMonth = async (organizationID, userId) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];
    
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
      },
      monthName: now.toLocaleDateString('en-US', { month: 'long' }),
      year: now.getFullYear()
    };
  } catch (error) {
    console.error('Error fetching user mileage data for current month:', error);
    throw error;
  }
};

/**
 * Get user mileage data for the current year
 * @param {string} organizationID - Organization ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User-specific mileage data for current year
 */
export const getUserMileageDataForCurrentYear = async (organizationID, userId) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    
    const startDate = startOfYear.toISOString().split('T')[0];
    const endDate = endOfYear.toISOString().split('T')[0];
    
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
      },
      year: now.getFullYear()
    };
  } catch (error) {
    console.error('Error fetching user mileage data for current year:', error);
    throw error;
  }
};

/**
 * Export mileage data to CSV format
 * @param {Object} mileageData - Mileage data object
 * @returns {string} CSV string
 */
/**
 * Debug function to inspect mileage data processing
 * @param {string} organizationID - Organization ID
 * @param {string} startDate - Start date in YYYY-MM-DD format  
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} Debug information about mileage processing
 */
export const debugMileageProcessing = async (organizationID, startDate, endDate) => {
  try {
    console.log(`[Debug] Starting mileage debug for ${organizationID} from ${startDate} to ${endDate}`);
    
    // Check daily reports cache
    const cachedDailyReports = dailyJobReportsCacheService.getCachedFullDataset(organizationID);
    if (!cachedDailyReports) {
      return { error: 'No cached daily reports found' };
    }
    
    console.log(`[Debug] Found ${cachedDailyReports.reports.length} cached reports`);
    
    // Check date formats in cache
    let dateFormats = { isoStrings: 0, firebaseObjects: 0, dateObjects: 0, unknown: 0 };
    let reportsWithMileage = 0;
    
    cachedDailyReports.reports.slice(0, 10).forEach((report, index) => {
      // Check date format
      if (typeof report.date === 'string') {
        dateFormats.isoStrings++;
      } else if (report.date instanceof Date) {
        dateFormats.dateObjects++;
      } else if (typeof report.date === 'object' && report.date.seconds) {
        dateFormats.firebaseObjects++;
      } else {
        dateFormats.unknown++;
      }
      
      // Check mileage
      if (report.totalMileage && report.totalMileage > 0) {
        reportsWithMileage++;
        console.log(`[Debug] Report ${index}: ${report.yourName} - ${report.totalMileage} miles on ${report.date}`);
      }
    });
    
    return {
      totalReports: cachedDailyReports.reports.length,
      dateFormats,
      reportsWithMileage,
      sampleReport: cachedDailyReports.reports[0]
    };
    
  } catch (error) {
    console.error('[Debug] Error in mileage debug:', error);
    return { error: error.message };
  }
};

// Add global debugging function for browser console
if (typeof window !== 'undefined') {
  window.debugMileageProcessing = debugMileageProcessing;
}

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