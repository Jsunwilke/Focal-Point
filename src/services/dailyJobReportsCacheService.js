// src/services/dailyJobReportsCacheService.js
import { readCounter } from './readCounter';

class DailyJobReportsCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_dailyReports_';
    this.CACHE_VERSION = '2.5'; // Fixed timestamp serialization and sorting
    this.MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days for full dataset
  }

  /**
   * Parse Firebase Timestamp display strings like "July 28, 2025 at 9:37:12 PM UTC-5"
   * IMPORTANT: Normalizes to start of day in local timezone to prevent boundary issues
   * @param {string} displayString - Firebase Timestamp display format
   * @returns {Date|null} Parsed Date object normalized to start of day
   */
  parseFirebaseDisplayString(displayString) {
    try {
      console.log(`[Cache] 🔍 Parsing Firebase display string: "${displayString}"`);
      
      // Handle Firebase Timestamp display format: "July 28, 2025 at 9:37:12 PM UTC-5"
      if (typeof displayString === 'string' && displayString.includes(' at ')) {
        
        // Extract just the date part (e.g., "July 28, 2025")
        const datePart = displayString.split(' at ')[0];
        console.log(`[Cache] 📅 Extracted date part: "${datePart}"`);
        
        // Parse just the date, ignoring time and timezone to prevent boundary issues
        const parsed = new Date(datePart);
        if (!isNaN(parsed.getTime())) {
          // Normalize to start of day in local timezone
          parsed.setHours(0, 0, 0, 0);
          console.log(`[Cache] ✅ Date parsing successful: ${parsed.toISOString()}`);
          console.log(`[Cache] 📅 Normalized to start of day: ${parsed.toDateString()}`);
          return parsed;
        }
        
        // Fallback: Try full parsing if date-only fails
        console.log(`[Cache] 🔄 Date-only parsing failed, trying full format...`);
        const match = displayString.match(/^(.+?) at (.+?) (UTC[+-]\d+)$/);
        if (match) {
          const [, datePartAlt, timePart, timezonePart] = match;
          
          // Try parsing with full date/time but still normalize to start of day
          const fullParsed = new Date(`${datePartAlt} ${timePart}`);
          if (!isNaN(fullParsed.getTime())) {
            fullParsed.setHours(0, 0, 0, 0);
            console.log(`[Cache] ✅ Full parsing successful, normalized to: ${fullParsed.toDateString()}`);
            return fullParsed;
          }
        }
        
        console.log(`[Cache] ❌ All Firebase display parsing attempts failed`);
      } else {
        console.log(`[Cache] ❌ Not a Firebase display format (no ' at ' found)`);
      }
      
      return null;
    } catch (error) {
      console.error('[Cache] ❌ Error parsing Firebase display string:', displayString, error);
      return null;
    }
  }

  /**
   * Convert various date formats to a standardized {seconds, nanoseconds} format for caching
   * @param {*} dateValue - Date in various formats
   * @param {string} fieldName - Field name for logging
   * @param {number} reportIndex - Report index for logging
   * @returns {Object|null} Standardized {seconds, nanoseconds} object or null
   */
  standardizeDateForCache(dateValue, fieldName, reportIndex) {
    try {
      if (!dateValue) return null;
      
      let dateObj = null;
      
      if (dateValue instanceof Date) {
        // JavaScript Date object
        dateObj = dateValue;
      } else if (typeof dateValue.toDate === 'function') {
        // Firebase Timestamp object with toDate method
        dateObj = dateValue.toDate();
      } else if (typeof dateValue === 'object' && dateValue.seconds) {
        // Already in {seconds, nanoseconds} format
        return dateValue;
      } else if (typeof dateValue === 'string') {
        if (dateValue.includes(' at ')) {
          // Firebase display string format
          dateObj = this.parseFirebaseDisplayString(dateValue);
        } else {
          // ISO string format
          dateObj = new Date(dateValue);
        }
      }
      
      if (dateObj && !isNaN(dateObj.getTime())) {
        // IMPORTANT: Normalize to start of day to prevent timezone boundary issues
        const normalized = new Date(dateObj);
        normalized.setHours(0, 0, 0, 0);
        
        return {
          seconds: Math.floor(normalized.getTime() / 1000),
          nanoseconds: 0 // Always 0 for start of day
        };
      }
      
      console.warn(`[Cache] Report ${reportIndex}: Unable to standardize ${fieldName}:`, typeof dateValue, dateValue);
      return null;
      
    } catch (error) {
      console.error(`[Cache] Report ${reportIndex}: Error standardizing ${fieldName}:`, error, dateValue);
      return null;
    }
  }

  /**
   * Convert cached date values back to Date objects with comprehensive format support
   * @param {*} cachedValue - Date value from cache
   * @param {string} fieldName - Field name for logging
   * @param {number} reportIndex - Report index for logging
   * @returns {Object} {success: boolean, date: Date|null, format: string}
   */
  convertCachedDateToDate(cachedValue, fieldName, reportIndex) {
    try {
      if (!cachedValue) {
        return { success: false, date: null, format: 'null' };
      }
      
      // Already a Date object (shouldn't happen after cache, but just in case)
      if (cachedValue instanceof Date) {
        return { success: true, date: cachedValue, format: 'already-date' };
      }
      
      // Standardized format: {seconds, nanoseconds}
      if (typeof cachedValue === 'object' && cachedValue.seconds) {
        try {
          const date = new Date(cachedValue.seconds * 1000);
          if (!isNaN(date.getTime())) {
            return { success: true, date, format: 'timestamp-object' };
          }
        } catch (error) {
          console.warn(`[Cache] Report ${reportIndex}: Failed to convert timestamp object for ${fieldName}:`, cachedValue, error);
        }
      }
      
      // String formats (old cache data or fallback storage)
      if (typeof cachedValue === 'string') {
        // Try ISO string format first
        if (cachedValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          try {
            const date = new Date(cachedValue);
            if (!isNaN(date.getTime())) {
              return { success: true, date, format: 'iso-string' };
            }
          } catch (error) {
            console.warn(`[Cache] Report ${reportIndex}: Failed to parse ISO string for ${fieldName}:`, cachedValue, error);
          }
        }
        
        // Try Firebase display format: "July 28, 2025 at 9:37:12 PM UTC-5"
        if (cachedValue.includes(' at ')) {
          const displayDate = this.parseFirebaseDisplayString(cachedValue);
          if (displayDate) {
            return { success: true, date: displayDate, format: 'firebase-display' };
          }
        }
        
        // Try general Date parsing as fallback
        try {
          const date = new Date(cachedValue);
          if (!isNaN(date.getTime())) {
            return { success: true, date, format: 'general-string' };
          }
        } catch (error) {
          console.warn(`[Cache] Report ${reportIndex}: Failed to parse general string for ${fieldName}:`, cachedValue, error);
        }
      }
      
      // Unknown format
      console.warn(`[Cache] Report ${reportIndex}: Unknown ${fieldName} format:`, typeof cachedValue, cachedValue);
      return { success: false, date: null, format: 'unknown' };
      
    } catch (error) {
      console.error(`[Cache] Report ${reportIndex}: Error converting ${fieldName}:`, error, cachedValue);
      return { success: false, date: null, format: 'error' };
    }
  }

  /**
   * Generate cache key for full dataset
   */
  generateFullDatasetCacheKey(organizationId) {
    return `${this.CACHE_PREFIX}full_${organizationId}`;
  }

  /**
   * Generate cache key for real-time subscription metadata
   */
  generateMetadataCacheKey(organizationId) {
    return `${this.CACHE_PREFIX}metadata_${organizationId}`;
  }

  /**
   * Get cached full dataset
   */
  getCachedFullDataset(organizationId) {
    try {
      const cacheKey = this.generateFullDatasetCacheKey(organizationId);
      console.log(`[Cache] Checking cache for key: ${cacheKey}`);
      
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        console.log(`[Cache] Cache miss: No data found in localStorage for key ${cacheKey}`);
        return null;
      }

      console.log(`[Cache] Cache found, size: ${(cached.length / 1024).toFixed(2)}KB`);
      const data = JSON.parse(cached);
      
      if (data.version !== this.CACHE_VERSION) {
        console.log(`[Cache] Cache miss: Version mismatch. Found: ${data.version}, Expected: ${this.CACHE_VERSION}`);
        return null;
      }
      
      const age = Date.now() - data.timestamp;
      const maxAge = this.MAX_CACHE_AGE;
      if (age > maxAge) {
        console.log(`[Cache] Cache miss: Expired. Age: ${(age / (24 * 60 * 60 * 1000)).toFixed(1)} days, Max: ${(maxAge / (24 * 60 * 60 * 1000)).toFixed(1)} days`);
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`[Cache] Cache hit: ${data.reports.length} reports, age: ${(age / (60 * 60 * 1000)).toFixed(1)} hours`);

      // Convert Firebase Timestamp objects and ISO strings back to Date objects
      let isoStringCount = 0;
      let timestampObjectCount = 0;
      let alreadyDateCount = 0;
      let unknownFormatCount = 0;
      
      data.reports.forEach((report, index) => {
        // Handle date field with comprehensive format support
        if (report.date) {
          const originalDate = report.date;
          const convertedDate = this.convertCachedDateToDate(report.date, 'date', index);
          if (convertedDate.success) {
            report.date = convertedDate.date;
            
            // Log date conversions for first few reports and any that might have issues
            if (index < 5 || convertedDate.format === 'firebase-display') {
              console.log(`[Cache] 📅 Report ${index} date conversion:`);
              console.log(`[Cache]   Original: ${typeof originalDate === 'string' ? `"${originalDate}"` : originalDate}`);
              console.log(`[Cache]   Converted: ${convertedDate.date.toISOString()} (${convertedDate.format})`);
              console.log(`[Cache]   Local time: ${convertedDate.date.toString()}`);
            }
            
            if (convertedDate.format === 'iso-string') isoStringCount++;
            else if (convertedDate.format === 'timestamp-object') timestampObjectCount++;
            else if (convertedDate.format === 'already-date') alreadyDateCount++;
          } else {
            console.warn(`[Cache] ❌ Report ${index} date conversion failed:`, originalDate);
            unknownFormatCount++;
          }
        }
        
        // Handle timestamp field with comprehensive format support
        if (report.timestamp) {
          const convertedTimestamp = this.convertCachedDateToDate(report.timestamp, 'timestamp', index);
          if (convertedTimestamp.success) {
            report.timestamp = convertedTimestamp.date;
          }
        }
      });
      
      console.log(`[Cache] Date conversion summary: ${isoStringCount} ISO strings, ${timestampObjectCount} Firebase objects, ${alreadyDateCount} already Date objects, ${unknownFormatCount} unknown formats`);

      return {
        reports: data.reports,
        lastUpdated: data.timestamp,
        totalReports: data.reports.length
      };
    } catch (error) {
      console.error('Error reading cached full dataset:', error);
      return null;
    }
  }

  /**
   * Cache full dataset
   */
  setCachedFullDataset(organizationId, reports) {
    try {
      const cacheKey = this.generateFullDatasetCacheKey(organizationId);
      console.log(`[Cache] Attempting to cache ${reports.length} reports for organization ${organizationId}`);
      
      // Check localStorage space before caching
      const storageEstimate = this.getLocalStorageSize();
      console.log(`[Cache] Current localStorage usage: ${(storageEstimate.used / (1024 * 1024)).toFixed(2)}MB`);
      
      // Serialize all date formats to standardized {seconds, nanoseconds} format
      console.log(`[Cache] Standardizing date formats for storage...`);
      let dateFormatStats = { 
        dateConversions: 0, 
        timestampConversions: 0, 
        dateFailures: 0, 
        timestampFailures: 0 
      };
      
      const serializedReports = reports.map((report, index) => {
        try {
          const serialized = { ...report };
          
          // Handle date field with comprehensive format support
          if (report.date) {
            const standardizedDate = this.standardizeDateForCache(report.date, 'date', index);
            if (standardizedDate) {
              serialized.date = standardizedDate;
              dateFormatStats.dateConversions++;
            } else {
              dateFormatStats.dateFailures++;
              console.warn(`[Cache] Report ${index}: Failed to convert date, keeping original:`, report.date);
              serialized.date = report.date; // Keep original as fallback
            }
          }
          
          // Handle timestamp field with comprehensive format support
          if (report.timestamp) {
            const standardizedTimestamp = this.standardizeDateForCache(report.timestamp, 'timestamp', index);
            if (standardizedTimestamp) {
              serialized.timestamp = standardizedTimestamp;
              dateFormatStats.timestampConversions++;
            } else {
              dateFormatStats.timestampFailures++;
              console.warn(`[Cache] Report ${index}: Failed to convert timestamp, keeping original:`, report.timestamp);
              serialized.timestamp = report.timestamp; // Keep original as fallback
            }
          }
          
          return serialized;
        } catch (err) {
          console.error(`[Cache] Error serializing report ${index}:`, err, report);
          console.error(`[Cache] Report date type:`, typeof report.date, report.date);
          console.error(`[Cache] Report timestamp type:`, typeof report.timestamp, report.timestamp);
          throw err;
        }
      });
      
      console.log(`[Cache] Standardization results: ${dateFormatStats.dateConversions} dates converted, ${dateFormatStats.timestampConversions} timestamps converted, ${dateFormatStats.dateFailures + dateFormatStats.timestampFailures} failures`);

      const data = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        reports: serializedReports
      };

      const jsonString = JSON.stringify(data);
      const sizeKB = (jsonString.length / 1024).toFixed(2);
      console.log(`[Cache] Serialized data size: ${sizeKB}KB`);

      localStorage.setItem(cacheKey, jsonString);
      console.log(`[Cache] ✅ Successfully cached ${reports.length} reports for organization ${organizationId} (${sizeKB}KB)`);
      
      // Verify the cache was written
      const verification = localStorage.getItem(cacheKey);
      if (!verification) {
        console.error(`[Cache] ❌ Cache verification failed - data not found after write`);
      } else {
        console.log(`[Cache] ✅ Cache verification successful`);
      }
      
    } catch (error) {
      console.error('[Cache] ❌ Error caching full dataset:', error);
      
      // Check if it's a quota exceeded error
      if (error.name === 'QuotaExceededError') {
        console.error('[Cache] ❌ localStorage quota exceeded. Cleaning up old cache...');
        this.cleanupOldCache();
        
        // Try again after cleanup
        try {
          const data = {
            version: this.CACHE_VERSION,
            timestamp: Date.now(),
            reports: reports.slice(0, Math.min(1000, reports.length)) // Store fewer reports if needed
          };
          localStorage.setItem(this.generateFullDatasetCacheKey(organizationId), JSON.stringify(data));
          console.log(`[Cache] ✅ Successfully cached ${data.reports.length} reports after cleanup`);
        } catch (retryError) {
          console.error('[Cache] ❌ Failed to cache even after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Update specific report in cache (for real-time updates)
   */
  updateReportInCache(organizationId, updatedReport) {
    try {
      const cached = this.getCachedFullDataset(organizationId);
      if (!cached) return false;

      const reports = cached.reports;
      const existingIndex = reports.findIndex(r => r.id === updatedReport.id);
      
      if (existingIndex >= 0) {
        // Update existing report
        reports[existingIndex] = updatedReport;
      } else {
        // Add new report (prepend to maintain timestamp order)
        reports.unshift(updatedReport);
      }

      this.setCachedFullDataset(organizationId, reports);
      return true;
    } catch (error) {
      console.error('Error updating report in cache:', error);
      return false;
    }
  }

  /**
   * Merge new reports into existing cache (for optimized real-time updates)
   */
  mergeNewReportsIntoCache(organizationId, newReports) {
    try {
      console.log(`[Cache] Starting merge of ${newReports.length} new reports for org ${organizationId}`);
      
      const cached = this.getCachedFullDataset(organizationId);
      if (!cached) {
        console.error('[Cache] No cached data found - cannot merge');
        return false;
      }

      const existingReports = cached.reports;
      console.log(`[Cache] Found ${existingReports.length} existing reports in cache`);
      
      // Create a map for stronger duplicate detection based on multiple fields
      const existingReportMap = new Map();
      existingReports.forEach(report => {
        // Create a composite key based on date, user, and job to prevent duplicates
        let dateStr = 'no-date';
        if (report.date) {
          try {
            // Handle various date formats (same logic as above)
            let dateObj;
            if (typeof report.date === 'string' && report.date.includes(' at ')) {
              dateObj = this.parseFirebaseDisplayString(report.date);
            } else if (report.date.toDate && typeof report.date.toDate === 'function') {
              dateObj = report.date.toDate();
            } else if (report.date instanceof Date) {
              dateObj = report.date;
            } else if (typeof report.date === 'string') {
              dateObj = new Date(report.date);
            } else if (typeof report.date === 'object' && report.date.seconds) {
              // Cached timestamp format
              dateObj = new Date(report.date.seconds * 1000);
            }
            
            if (dateObj && !isNaN(dateObj.getTime())) {
              dateStr = dateObj.toISOString().split('T')[0];
            }
          } catch (error) {
            console.warn(`[Cache] Error parsing existing report date:`, error);
          }
        }
        
        const userId = report.userId || report.yourName || 'unknown';
        const jobId = report.jobId || report.id || 'unknown';
        const compositeKey = `${dateStr}_${userId}_${jobId}`;
        
        // Also track by ID for backward compatibility
        if (report.id) {
          existingReportMap.set(report.id, report);
        }
        existingReportMap.set(compositeKey, report);
      });
      
      // Filter out reports that already exist in cache (check both ID and composite key)
      const uniqueNewReports = newReports.filter(report => {
        // Check by ID first
        if (report.id && existingReportMap.has(report.id)) {
          console.log(`[Cache] Duplicate detected by ID: ${report.id}`);
          return false;
        }
        
        // Check by composite key
        let dateStr = 'no-date';
        if (report.date) {
          try {
            // Handle various date formats
            let dateObj;
            if (typeof report.date === 'string' && report.date.includes(' at ')) {
              // Firebase display string
              dateObj = this.parseFirebaseDisplayString(report.date);
            } else if (report.date.toDate && typeof report.date.toDate === 'function') {
              // Firebase Timestamp
              dateObj = report.date.toDate();
            } else if (report.date instanceof Date) {
              dateObj = report.date;
            } else if (typeof report.date === 'string') {
              dateObj = new Date(report.date);
            } else {
              console.warn(`[Cache] Unknown date format for report:`, report.date);
            }
            
            if (dateObj && !isNaN(dateObj.getTime())) {
              dateStr = dateObj.toISOString().split('T')[0];
            }
          } catch (error) {
            console.warn(`[Cache] Error parsing date for duplicate check:`, error);
          }
        }
        
        const userId = report.userId || report.yourName || 'unknown';
        const jobId = report.jobId || report.id || 'unknown';
        const compositeKey = `${dateStr}_${userId}_${jobId}`;
        
        if (existingReportMap.has(compositeKey)) {
          console.log(`[Cache] Duplicate detected by composite key: ${compositeKey}`);
          return false;
        }
        
        return true;
      });
      
      if (uniqueNewReports.length === 0) {
        console.log('[Cache] No new unique reports to merge into cache');
        return true;
      }
      
      console.log(`[Cache] Merging ${uniqueNewReports.length} new unique reports (filtered from ${newReports.length})`);

      // Merge new reports with existing (prepend new reports to maintain timestamp order)
      const mergedReports = [...uniqueNewReports, ...existingReports];
      
      // Sort by timestamp descending to ensure proper order
      mergedReports.sort((a, b) => {
        let aTime = 0;
        let bTime = 0;
        
        // Get timestamp A
        if (a.timestamp) {
          if (typeof a.timestamp.getTime === 'function') {
            aTime = a.timestamp.getTime();
          } else if (typeof a.timestamp.toDate === 'function') {
            aTime = a.timestamp.toDate().getTime();
          } else if (a.timestamp.seconds) {
            aTime = a.timestamp.seconds * 1000; // Convert seconds to milliseconds
          }
        }
        
        // Get timestamp B
        if (b.timestamp) {
          if (typeof b.timestamp.getTime === 'function') {
            bTime = b.timestamp.getTime();
          } else if (typeof b.timestamp.toDate === 'function') {
            bTime = b.timestamp.toDate().getTime();
          } else if (b.timestamp.seconds) {
            bTime = b.timestamp.seconds * 1000; // Convert seconds to milliseconds
          }
        }
        
        return bTime - aTime;
      });

      this.setCachedFullDataset(organizationId, mergedReports);
      console.log(`[Cache] Successfully merged ${uniqueNewReports.length} new reports into cache (total: ${mergedReports.length})`);
      return true;
    } catch (error) {
      console.error('[Cache] Error merging new reports into cache:', error);
      console.error('[Cache] Error details:', error.message, error.stack);
      return false;
    }
  }

  /**
   * Remove report from cache
   */
  removeReportFromCache(organizationId, reportId) {
    try {
      const cached = this.getCachedFullDataset(organizationId);
      if (!cached) return false;

      const filteredReports = cached.reports.filter(r => r.id !== reportId);
      this.setCachedFullDataset(organizationId, filteredReports);
      return true;
    } catch (error) {
      console.error('Error removing report from cache:', error);
      return false;
    }
  }

  /**
   * Get cached browse reports for a specific page (legacy method - keeping for compatibility)
   */
  getCachedBrowseReports(organizationId, page, limit, sortBy = 'date', sortOrder = 'desc') {
    try {
      const cacheKey = this.generateBrowseCacheKey(organizationId, page, limit, sortBy, sortOrder);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      if (data.version !== this.CACHE_VERSION) return null;
      if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Convert Firebase Timestamp objects back
      data.reports.forEach(report => {
        if (report.date && typeof report.date === 'object' && report.date.seconds) {
          report.date = new Date(report.date.seconds * 1000);
        }
        if (report.timestamp && typeof report.timestamp === 'object' && report.timestamp.seconds) {
          report.timestamp = new Date(report.timestamp.seconds * 1000);
        }
      });

      return {
        reports: data.reports,
        pagination: data.pagination,
        lastUpdated: data.timestamp
      };
    } catch (error) {
      console.error('Error reading cached browse reports:', error);
      return null;
    }
  }

  /**
   * Cache browse reports for a specific page
   */
  setCachedBrowseReports(organizationId, page, limit, sortBy, sortOrder, reports, pagination) {
    try {
      const cacheKey = this.generateBrowseCacheKey(organizationId, page, limit, sortBy, sortOrder);
      
      // Serialize Firebase Timestamps for storage
      const serializedReports = reports.map(report => {
        const serialized = { ...report };
        
        // Properly serialize Firebase Timestamps
        if (report.date && typeof report.date.toDate === 'function') {
          // Firebase Timestamp - convert to serializable format
          const dateObj = report.date.toDate();
          serialized.date = { 
            seconds: Math.floor(dateObj.getTime() / 1000), 
            nanoseconds: 0 
          };
        }
        
        if (report.timestamp && typeof report.timestamp.toDate === 'function') {
          // Firebase Timestamp - convert to serializable format
          const timestampObj = report.timestamp.toDate();
          serialized.timestamp = { 
            seconds: Math.floor(timestampObj.getTime() / 1000), 
            nanoseconds: 0 
          };
        }
        
        return serialized;
      });

      const data = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        reports: serializedReports,
        pagination,
        sortBy,
        sortOrder
      };

      localStorage.setItem(cacheKey, JSON.stringify(data));
      
      // Update metadata cache
      this.updateMetadataCache(organizationId, page, pagination);
      
    } catch (error) {
      console.error('Error caching browse reports:', error);
      // Clean up old cache entries if storage is full
      this.cleanupOldCache();
    }
  }

  /**
   * Update metadata cache for tracking latest data
   */
  updateMetadataCache(organizationId, currentPage, pagination) {
    try {
      const metaKey = this.generateMetadataCacheKey(organizationId);
      const metadata = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        currentPage,
        pagination,
        lastUpdateTime: Date.now()
      };
      localStorage.setItem(metaKey, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error updating metadata cache:', error);
    }
  }

  /**
   * Get latest timestamp for optimized real-time listener
   */
  getLatestTimestamp(organizationId) {
    try {
      console.log(`[Cache] Getting latest timestamp for organization ${organizationId}`);
      const cachedData = this.getCachedFullDataset(organizationId);
      
      if (!cachedData) {
        console.log(`[Cache] No cached data found for timestamp extraction`);
        return null;
      }
      
      if (!cachedData.reports || cachedData.reports.length === 0) {
        console.log(`[Cache] No reports in cached data (length: ${cachedData.reports?.length || 0})`);
        return null;
      }

      console.log(`[Cache] Extracting timestamp from ${cachedData.reports.length} cached reports`);
      
      // Find the most recent report timestamp (reports should be ordered by timestamp desc)
      const latestReport = cachedData.reports[0];
      console.log(`[Cache] Latest report structure:`, {
        id: latestReport.id,
        timestamp: latestReport.timestamp,
        timestampType: typeof latestReport.timestamp,
        date: latestReport.date,
        dateType: typeof latestReport.date
      });
      
      if (latestReport && latestReport.timestamp) {
        // Handle both Date objects and Firebase Timestamp objects
        if (typeof latestReport.timestamp.toDate === 'function') {
          const result = latestReport.timestamp.toDate();
          console.log(`[Cache] ✅ Extracted timestamp from Firebase Timestamp: ${result.toISOString()}`);
          return result;
        } else if (latestReport.timestamp instanceof Date) {
          console.log(`[Cache] ✅ Using JavaScript Date timestamp: ${latestReport.timestamp.toISOString()}`);
          return latestReport.timestamp;
        } else if (typeof latestReport.timestamp === 'object' && latestReport.timestamp.seconds) {
          const result = new Date(latestReport.timestamp.seconds * 1000);
          console.log(`[Cache] ✅ Converted serialized timestamp: ${result.toISOString()}`);
          return result;
        } else {
          console.log(`[Cache] ⚠️ Unknown timestamp format:`, latestReport.timestamp);
        }
      }
      
      // Fallback: try to use the date field
      if (latestReport && latestReport.date) {
        console.log(`[Cache] 🔄 Falling back to date field:`, latestReport.date);
        if (typeof latestReport.date.toDate === 'function') {
          const result = latestReport.date.toDate();
          console.log(`[Cache] ✅ Extracted timestamp from Firebase Date: ${result.toISOString()}`);
          return result;
        } else if (latestReport.date instanceof Date) {
          console.log(`[Cache] ✅ Using JavaScript Date from date field: ${latestReport.date.toISOString()}`);
          return latestReport.date;
        } else if (typeof latestReport.date === 'object' && latestReport.date.seconds) {
          const result = new Date(latestReport.date.seconds * 1000);
          console.log(`[Cache] ✅ Converted serialized date: ${result.toISOString()}`);
          return result;
        }
      }
      
      console.log(`[Cache] ❌ Could not extract timestamp from latest report`);
      return null;
    } catch (error) {
      console.error('[Cache] ❌ Error getting latest timestamp:', error);
      return null;
    }
  }

  /**
   * Prepend new reports to existing cache (for real-time updates)
   */
  prependNewReports(organizationId, page, limit, sortBy, sortOrder, newReports) {
    try {
      const cacheKey = this.generateBrowseCacheKey(organizationId, page, limit, sortBy, sortOrder);
      const existingData = this.getCachedBrowseReports(organizationId, page, limit, sortBy, sortOrder);
      
      if (!existingData) return false;

      // Merge new reports with existing, removing duplicates
      const existingIds = new Set(existingData.reports.map(r => r.id));
      const uniqueNewReports = newReports.filter(report => !existingIds.has(report.id));
      
      if (uniqueNewReports.length === 0) return true;

      // For date desc sort, prepend new reports
      let updatedReports;
      if (sortBy === 'date' && sortOrder === 'desc') {
        updatedReports = [...uniqueNewReports, ...existingData.reports];
      } else {
        // For other sorts, re-sort the combined list
        updatedReports = [...uniqueNewReports, ...existingData.reports].sort((a, b) => {
          let aValue = a[sortBy] || '';
          let bValue = b[sortBy] || '';

          if (sortBy === 'date' || sortBy === 'timestamp') {
            aValue = a[sortBy]?.getTime?.() || a[sortBy]?.seconds || 0;
            bValue = b[sortBy]?.getTime?.() || b[sortBy]?.seconds || 0;
          } else {
            aValue = String(aValue).toLowerCase();
            bValue = String(bValue).toLowerCase();
          }

          if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          } else {
            return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
          }
        });
      }

      // Keep only the page size limit
      updatedReports = updatedReports.slice(0, limit);

      // Update cache with new data
      this.setCachedBrowseReports(organizationId, page, limit, sortBy, sortOrder, updatedReports, existingData.pagination);
      
      return true;
    } catch (error) {
      console.error('Error prepending new reports to cache:', error);
      return false;
    }
  }

  /**
   * Clear specific page cache
   */
  clearPageCache(organizationId, page, limit, sortBy, sortOrder) {
    try {
      const cacheKey = this.generateBrowseCacheKey(organizationId, page, limit, sortBy, sortOrder);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing page cache:', error);
    }
  }

  /**
   * Clear all cached reports for organization
   */
  clearAllReportsCache(organizationId) {
    try {
      const keys = Object.keys(localStorage);
      const reportsCacheKeys = keys.filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}browse_${organizationId}`) ||
        key.startsWith(`${this.CACHE_PREFIX}metadata_${organizationId}`) ||
        key.startsWith(`${this.CACHE_PREFIX}full_${organizationId}`)
      );
      reportsCacheKeys.forEach(key => localStorage.removeItem(key));
      console.log(`[Cache] Cleared ${reportsCacheKeys.length} cached entries for organization ${organizationId}`);
    } catch (error) {
      console.error('[Cache] Error clearing reports cache:', error);
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupOldCache() {
    try {
      const keys = Object.keys(localStorage);
      const reportsCacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      reportsCacheKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
            localStorage.removeItem(key);
          }
        } catch (error) {
          localStorage.removeItem(key); // Remove corrupted entries
        }
      });
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(organizationId) {
    try {
      const keys = Object.keys(localStorage);
      const reportsCacheKeys = keys.filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}browse_${organizationId}`)
      );
      
      let totalSize = 0;
      let validEntries = 0;
      let expiredEntries = 0;
      let totalReports = 0;

      reportsCacheKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          totalSize += value ? value.length : 0;
          
          const data = JSON.parse(value);
          if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
            expiredEntries++;
          } else {
            validEntries++;
            totalReports += data.reports ? data.reports.length : 0;
          }
        } catch (error) {
          expiredEntries++;
        }
      });

      return {
        totalEntries: reportsCacheKeys.length,
        validEntries,
        expiredEntries,
        totalReports,
        totalSizeBytes: totalSize,
        maxAgeHours: this.MAX_CACHE_AGE / (60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Check if reports should be refreshed based on cache age
   */
  shouldRefreshCache(organizationId, page, limit, sortBy, sortOrder, maxAgeMinutes = 60) {
    try {
      const cached = this.getCachedBrowseReports(organizationId, page, limit, sortBy, sortOrder);
      if (!cached) return true;
      
      const ageMinutes = (Date.now() - cached.lastUpdated) / (60 * 1000);
      return ageMinutes > maxAgeMinutes;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get localStorage size estimation
   */
  getLocalStorageSize() {
    try {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          total += localStorage[key].length + key.length;
        }
      }
      return {
        used: total,
        quota: 5 * 1024 * 1024, // Rough estimate: 5MB typical quota
        percentage: (total / (5 * 1024 * 1024)) * 100
      };
    } catch (error) {
      return { used: 0, quota: 0, percentage: 0 };
    }
  }

  /**
   * Test date format handling with sample data
   */
  testDateFormatHandling() {
    console.log('[Cache] Testing date format handling...');
    
    const testCases = [
      { type: 'ISO string (old format)', value: '2025-02-08T00:00:00.000Z' },
      { type: 'Firebase display (new format)', value: 'July 28, 2025 at 9:37:12 PM UTC-5' },
      { type: 'Alternative Firebase display', value: 'February 8, 2025 at 12:00:00 AM UTC-5' },
      { type: 'Date object', value: new Date() },
      { type: 'Timestamp object', value: { seconds: 1641234567, nanoseconds: 123456789 } },
      { type: 'Invalid string', value: 'invalid date' },
      { type: 'Null', value: null }
    ];
    
    testCases.forEach((testCase, index) => {
      console.log(`\n[Test ${index + 1}] ${testCase.type}:`, testCase.value);
      
      // Test standardization for caching
      const standardized = this.standardizeDateForCache(testCase.value, 'testField', index);
      console.log('  Standardized for cache:', standardized);
      
      // Test conversion from cache
      if (standardized) {
        const converted = this.convertCachedDateToDate(standardized, 'testField', index);
        console.log('  Converted from cache:', converted);
      }
      
      // Test Firebase display parsing if applicable
      if (testCase.type === 'Firebase display') {
        const parsed = this.parseFirebaseDisplayString(testCase.value);
        console.log('  Firebase display parsed:', parsed);
      }
    });
    
    console.log('\n[Cache] Date format testing complete.');
  }

  /**
   * Add cache inspection method for debugging
   */
  inspectCache(organizationId) {
    const cacheKey = this.generateFullDatasetCacheKey(organizationId);
    const cached = localStorage.getItem(cacheKey);
    
    console.log(`[Cache] Inspection for organization ${organizationId}:`);
    console.log(`[Cache] Key: ${cacheKey}`);
    
    if (!cached) {
      console.log(`[Cache] ❌ No cache found`);
      return null;
    }
    
    try {
      const data = JSON.parse(cached);
      console.log(`[Cache] ✅ Cache found:`);
      console.log(`[Cache]   Version: ${data.version} (expected: ${this.CACHE_VERSION})`);
      console.log(`[Cache]   Timestamp: ${new Date(data.timestamp).toISOString()}`);
      console.log(`[Cache]   Reports: ${data.reports?.length || 0}`);
      console.log(`[Cache]   Size: ${(cached.length / 1024).toFixed(2)}KB`);
      console.log(`[Cache]   Age: ${((Date.now() - data.timestamp) / (60 * 60 * 1000)).toFixed(1)} hours`);
      
      if (data.reports?.length > 0) {
        const firstReport = data.reports[0];
        console.log(`[Cache]   First report date: ${firstReport.date}`);
        console.log(`[Cache]   First report timestamp: ${firstReport.timestamp}`);
      }
      
      return data;
    } catch (error) {
      console.error(`[Cache] ❌ Error parsing cache:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const dailyJobReportsCacheService = new DailyJobReportsCacheService();

// Add global debugging functions for browser console
if (typeof window !== 'undefined') {
  window.testDateFormatHandling = () => dailyJobReportsCacheService.testDateFormatHandling();
  window.testFirebaseDisplayParsing = (displayString) => {
    console.log(`[Test] Testing Firebase display string parsing for: "${displayString}"`);
    const result = dailyJobReportsCacheService.parseFirebaseDisplayString(displayString);
    console.log(`[Test] Result:`, result);
    console.log(`[Test] Date in your timezone: ${result ? result.toString() : 'null'}`);
    console.log(`[Test] Date only: ${result ? result.toDateString() : 'null'}`);
    console.log(`[Test] YYYY-MM-DD format: ${result ? result.toISOString().split('T')[0] : 'null'}`);
    return result;
  };
  window.debugJuly26Issue = () => {
    console.log('[Test] 🔍 Debugging the July 26th date issue...');
    
    // Test various July 26th formats that might be in your data
    const testDates = [
      'July 26, 2025 at 11:59:59 PM UTC-5',
      'July 26, 2025 at 11:30:00 PM UTC-5', 
      'July 26, 2025 at 10:00:00 PM UTC-5',
      'July 26, 2025 at 6:00:00 PM UTC-5'
    ];
    
    testDates.forEach(dateString => {
      console.log(`\n[Test] Testing: "${dateString}"`);
      const parsed = dailyJobReportsCacheService.parseFirebaseDisplayString(dateString);
      if (parsed) {
        const dateOnly = parsed.toISOString().split('T')[0];
        console.log(`[Test] Parsed to: ${dateOnly} (${dateOnly === '2025-07-26' ? '✅ CORRECT' : '❌ WRONG - should be 2025-07-26'})`);
      }
    });
  };
  window.inspectDailyReportsCache = (organizationId) => {
    if (organizationId) {
      return dailyJobReportsCacheService.inspectCache(organizationId);
    } else {
      console.log('[Cache] Please provide organizationId: inspectDailyReportsCache("org-id")');
    }
  };
  window.clearDailyReportsCache = (organizationId) => {
    if (organizationId) {
      dailyJobReportsCacheService.clearAllReportsCache(organizationId);
      console.log(`[Cache] Cleared daily reports cache for organization ${organizationId}`);
    } else {
      console.log('[Cache] Please provide organizationId: clearDailyReportsCache("org-id")');
    }
  };
}

export default dailyJobReportsCacheService;