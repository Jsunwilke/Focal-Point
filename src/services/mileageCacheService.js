// Mileage cache service to reduce duplicate queries for pay periods
class MileageCacheService {
  constructor() {
    this.CACHE_VERSION = '1.5'; // Bump version for July 26 fix with report-level tracking
    this.CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours - pay period data rarely changes during the day
    this.MILEAGE_KEY_PREFIX = 'mileage_data_';
  }

  // Helper to serialize timestamps
  serializeData(data) {
    return JSON.stringify(data, (key, value) => {
      if (value && value.toDate && typeof value.toDate === 'function') {
        return { _type: 'timestamp', _value: value.toDate().toISOString() };
      }
      if (value instanceof Date) {
        return { _type: 'date', _value: value.toISOString() };
      }
      return value;
    });
  }

  // Helper to deserialize timestamps
  deserializeData(json) {
    return JSON.parse(json, (key, value) => {
      if (value && value._type === 'timestamp') {
        return { toDate: () => new Date(value._value) };
      }
      if (value && value._type === 'date') {
        return new Date(value._value);
      }
      return value;
    });
  }

  // Get cache key for mileage data
  getMileageKey(organizationId, startDate, endDate, userIds = null) {
    const userIdStr = userIds ? userIds.sort().join(',') : 'all';
    const key = `${this.MILEAGE_KEY_PREFIX}${organizationId}_${startDate}_${endDate}_${userIdStr}`;
    return key;
  }

  // Get cached mileage data
  getCachedMileageData(organizationId, startDate, endDate, userIds = null) {
    try {
      const key = this.getMileageKey(organizationId, startDate, endDate, userIds);
      const cached = localStorage.getItem(key);
      
      if (!cached) {
        return null;
      }

      const cacheData = this.deserializeData(cached);
      
      // Check cache version and age
      const isExpired = Date.now() - cacheData.timestamp > this.CACHE_DURATION;
      const isWrongVersion = cacheData.version !== this.CACHE_VERSION;
      
      
      if (isWrongVersion || isExpired) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      return null;
    }
  }

  // Cache mileage data
  setCachedMileageData(organizationId, startDate, endDate, data, userIds = null) {
    try {
      const key = this.getMileageKey(organizationId, startDate, endDate, userIds);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: data
      };
      
      
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
    }
  }

  // Clear all mileage caches for an organization
  clearOrganizationCache(organizationId) {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      keys.forEach(key => {
        if (key.startsWith(this.MILEAGE_KEY_PREFIX) && key.includes(organizationId)) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
    } catch (error) {
    }
  }

  // Force clear all mileage caches (useful after pay period boundary fixes)
  clearAllMileageCache() {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      keys.forEach(key => {
        if (key.startsWith(this.MILEAGE_KEY_PREFIX)) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });
      return clearedCount;
    } catch (error) {
      return 0;
    }
  }

  // Clear expired caches
  clearExpiredCaches() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith(this.MILEAGE_KEY_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData = this.deserializeData(cached);
              if (cacheData.version !== this.CACHE_VERSION || 
                  now - cacheData.timestamp > this.CACHE_DURATION) {
                localStorage.removeItem(key);
                clearedCount++;
              }
            }
          } catch (error) {
            // Remove corrupted cache entries
            localStorage.removeItem(key);
            clearedCount++;
          }
        }
      });
      
      if (clearedCount > 0) {
      }
    } catch (error) {
    }
  }

  // Get cache info for debugging
  getCacheInfo() {
    try {
      const keys = Object.keys(localStorage);
      const mileageCaches = [];
      
      keys.forEach(key => {
        if (key.startsWith(this.MILEAGE_KEY_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData = this.deserializeData(cached);
              const age = Date.now() - cacheData.timestamp;
              mileageCaches.push({
                key: key,
                age: Math.round(age / 1000 / 60) + ' minutes',
                size: cached.length,
                expired: age > this.CACHE_DURATION,
                reports: cacheData.data?.dailyReports?.length || 0,
                period: `${cacheData.data?.period?.startDate} to ${cacheData.data?.period?.endDate}`
              });
            }
          } catch (error) {
            // Skip corrupted entries
          }
        }
      });
      
      return mileageCaches;
    } catch (error) {
      return [];
    }
  }

  // Add debugging function for browser console
  inspectCache() {
    const cacheInfo = this.getCacheInfo();
    cacheInfo.forEach((entry, index) => {
    });
    if (cacheInfo.length === 0) {
    }
    return cacheInfo;
  }

  // Debug function to check for pay period overlaps
  checkPayPeriodOverlaps() {
    try {
      const cacheInfo = this.getCacheInfo();
      const periods = [];
      
      
      cacheInfo.forEach(entry => {
        if (entry.period && entry.period.includes(' to ')) {
          const [startStr, endStr] = entry.period.split(' to ');
          const startDate = new Date(startStr);
          const endDate = new Date(endStr);
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            periods.push({
              key: entry.key,
              start: startDate,
              end: endDate,
              startStr: startStr,
              endStr: endStr,
              reports: entry.reports
            });
          }
        }
      });
      
      // Check for overlaps
      const overlaps = [];
      for (let i = 0; i < periods.length; i++) {
        for (let j = i + 1; j < periods.length; j++) {
          const period1 = periods[i];
          const period2 = periods[j];
          
          // Check if periods overlap
          const overlap = (period1.start <= period2.end && period1.end >= period2.start) ||
                         (period2.start <= period1.end && period2.end >= period1.start);
          
          if (overlap) {
            overlaps.push({
              period1: `${period1.startStr} to ${period1.endStr}`,
              period2: `${period2.startStr} to ${period2.endStr}`,
              key1: period1.key,
              key2: period2.key,
              reports1: period1.reports,
              reports2: period2.reports
            });
          }
        }
      }
      
      if (overlaps.length > 0) {
        overlaps.forEach((overlap, index) => {
        });
      } else {
      }
      
      return { periods, overlaps };
    } catch (error) {
      return { periods: [], overlaps: [] };
    }
  }
}

const mileageCacheService = new MileageCacheService();

// Run cleanup on initialization
mileageCacheService.clearExpiredCaches();

// Force clear all mileage cache due to pay period boundary fixes in v1.2
// This ensures clean regeneration with corrected boundaries
const clearedCount = mileageCacheService.clearAllMileageCache();
if (clearedCount > 0) {
}

// Add global debugging functions for browser console
if (typeof window !== 'undefined') {
  window.inspectMileageCache = () => mileageCacheService.inspectCache();
  window.checkMileagePayPeriodOverlaps = () => mileageCacheService.checkPayPeriodOverlaps();
  window.clearMileageCache = (organizationId) => {
    if (organizationId) {
      mileageCacheService.clearOrganizationCache(organizationId);
    } else {
    }
  };
  window.forceClearAllMileageCache = () => {
    const cleared = mileageCacheService.clearAllMileageCache();
    return cleared;
  };
}

export default mileageCacheService;