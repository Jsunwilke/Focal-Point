// src/services/dailyReportsSearchService.js
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { readCounter } from './readCounter';

class DailyReportsSearchService {
  constructor() {
    this.searchFunction = httpsCallable(functions, 'searchDailyReports');
    this.cache = new Map();
    this.CACHE_PREFIX = 'focal_dailyReports_search_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes for search results
  }

  /**
   * Generate cache key for search parameters
   */
  generateCacheKey(params) {
    const { searchTerm, photographerId, schoolId, dateFrom, dateTo, sortBy, sortOrder, page, limit } = params;
    return `${this.CACHE_PREFIX}${JSON.stringify({
      searchTerm: searchTerm || '',
      photographerId: photographerId || '',
      schoolId: schoolId || '',
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      sortBy: sortBy || 'date',
      sortOrder: sortOrder || 'desc',
      page: page || 1,
      limit: limit || 50
    })}`;
  }

  /**
   * Get cached search results if available and not expired
   */
  getCachedResults(cacheKey) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const data = JSON.parse(cached);
      if (data.version !== this.CACHE_VERSION) return null;
      if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data.results;
    } catch (error) {
      console.error('Error reading cached search results:', error);
      return null;
    }
  }

  /**
   * Cache search results
   */
  setCachedResults(cacheKey, results) {
    try {
      const data = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        results
      };
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching search results:', error);
      // Clean up old cache entries if storage is full
      this.cleanupOldCache();
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupOldCache() {
    try {
      const keys = Object.keys(localStorage);
      const searchCacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      // Remove old entries (older than cache age)
      searchCacheKeys.forEach(key => {
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
   * Search daily reports with server-side pagination
   * @param {Object} params - Search parameters
   * @param {string} params.searchTerm - Text to search for
   * @param {string} params.photographerId - Filter by photographer ID
   * @param {string} params.schoolId - Filter by school ID
   * @param {string} params.dateFrom - Start date filter (YYYY-MM-DD)
   * @param {string} params.dateTo - End date filter (YYYY-MM-DD)
   * @param {string} params.sortBy - Field to sort by (date, photographer, school)
   * @param {string} params.sortOrder - Sort order (asc, desc)
   * @param {number} params.page - Page number (1-based)
   * @param {number} params.limit - Results per page
   * @returns {Promise<Object>} Search results with pagination metadata
   */
  async searchDailyReports(params = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(params);

    try {
      // Check cache first
      const cachedResults = this.getCachedResults(cacheKey);
      if (cachedResults) {
        readCounter.recordCacheHit('dailyReports', 'DailyReportsSearch', cachedResults.reports.length);
        console.log(`Cache hit for daily reports search (${Date.now() - startTime}ms)`);
        return cachedResults;
      }

      // Record cache miss
      readCounter.recordCacheMiss('dailyReports', 'DailyReportsSearch');

      // Call Cloud Function
      console.log('Calling searchDailyReports Cloud Function with params:', params);
      const result = await this.searchFunction(params);
      
      if (!result.data) {
        throw new Error('No data returned from search function');
      }

      const { reports, pagination, executionTime } = result.data;
      
      // Record the read operation
      readCounter.recordRead(
        'cloud_function',
        'dailyReports',
        'DailyReportsSearch',
        reports.length
      );

      // Cache the results
      this.setCachedResults(cacheKey, { reports, pagination });

      console.log(`Daily reports search completed in ${Date.now() - startTime}ms (server: ${executionTime}ms)`);
      console.log(`Found ${reports.length} reports, ${pagination.totalPages} total pages`);

      return { reports, pagination };

    } catch (error) {
      console.error('Error searching daily reports:', error);
      
      // Record the error
      readCounter.recordRead(
        'cloud_function_error',
        'dailyReports',
        'DailyReportsSearch',
        0
      );

      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Get the next page of results
   */
  async getNextPage(currentParams, currentPage) {
    return this.searchDailyReports({
      ...currentParams,
      page: currentPage + 1
    });
  }

  /**
   * Get the previous page of results
   */
  async getPreviousPage(currentParams, currentPage) {
    if (currentPage <= 1) return null;
    
    return this.searchDailyReports({
      ...currentParams,
      page: currentPage - 1
    });
  }

  /**
   * Clear all cached search results
   */
  clearSearchCache() {
    try {
      const keys = Object.keys(localStorage);
      const searchCacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      searchCacheKeys.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${searchCacheKeys.length} cached search results`);
    } catch (error) {
      console.error('Error clearing search cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    try {
      const keys = Object.keys(localStorage);
      const searchCacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      let validEntries = 0;
      let expiredEntries = 0;

      searchCacheKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          totalSize += value ? value.length : 0;
          
          const data = JSON.parse(value);
          if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
            expiredEntries++;
          } else {
            validEntries++;
          }
        } catch (error) {
          expiredEntries++;
        }
      });

      return {
        totalEntries: searchCacheKeys.length,
        validEntries,
        expiredEntries,
        totalSizeBytes: totalSize,
        maxAgeMinutes: this.MAX_CACHE_AGE / (60 * 1000)
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const dailyReportsSearchService = new DailyReportsSearchService();
export default dailyReportsSearchService;