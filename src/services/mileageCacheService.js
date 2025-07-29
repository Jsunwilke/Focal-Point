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
    console.log(`[MileageCache DEBUG] Generated cache key: ${key}`);
    return key;
  }

  // Get cached mileage data
  getCachedMileageData(organizationId, startDate, endDate, userIds = null) {
    try {
      const key = this.getMileageKey(organizationId, startDate, endDate, userIds);
      const cached = localStorage.getItem(key);
      
      if (!cached) {
        console.log(`[MileageCache DEBUG] No cache found for key: ${key}`);
        return null;
      }

      const cacheData = this.deserializeData(cached);
      
      // Check cache version and age
      const isExpired = Date.now() - cacheData.timestamp > this.CACHE_DURATION;
      const isWrongVersion = cacheData.version !== this.CACHE_VERSION;
      
      console.log(`[MileageCache DEBUG] Cache validation for ${key}:`);
      console.log(`  Version: ${cacheData.version} (expected: ${this.CACHE_VERSION}) - ${isWrongVersion ? 'INVALID' : 'VALID'}`);
      console.log(`  Age: ${Math.round((Date.now() - cacheData.timestamp) / 1000 / 60)} minutes - ${isExpired ? 'EXPIRED' : 'VALID'}`);
      console.log(`  Reports: ${cacheData.data?.dailyReports?.length || 0}`);
      
      if (isWrongVersion || isExpired) {
        console.log(`[MileageCache DEBUG] Removing invalid cache for ${key}`);
        localStorage.removeItem(key);
        return null;
      }

      console.log(`[Cache Hit] Mileage data for period ${startDate} to ${endDate} (${cacheData.data?.dailyReports?.length || 0} reports)`);
      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached mileage data:', error);
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
      
      console.log(`[MileageCache DEBUG] Setting cache for key: ${key}`);
      console.log(`  Reports to cache: ${data?.dailyReports?.length || 0}`);
      console.log(`  Period: ${startDate} to ${endDate}`);
      console.log(`  Total miles in data: ${data?.summary?.totalMiles || 0}`);
      
      localStorage.setItem(key, this.serializeData(cacheData));
      console.log(`[Cache Set] Mileage data for period ${startDate} to ${endDate} (${data?.dailyReports?.length || 0} reports)`);
    } catch (error) {
      console.warn('Failed to cache mileage data:', error);
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
      console.log(`[Cache Clear] Cleared ${clearedCount} mileage cache entries for organization ${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear mileage cache:', error);
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
      console.log(`[Cache Clear] Force cleared ${clearedCount} mileage cache entries due to pay period boundary fixes`);
      return clearedCount;
    } catch (error) {
      console.warn('Failed to force clear mileage cache:', error);
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
        console.log(`[Cache Clear] Removed ${clearedCount} expired mileage cache entries`);
      }
    } catch (error) {
      console.warn('Failed to clear expired mileage caches:', error);
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
      console.warn('Failed to get cache info:', error);
      return [];
    }
  }

  // Add debugging function for browser console
  inspectCache() {
    const cacheInfo = this.getCacheInfo();
    console.log('[Mileage Cache] Current cache entries:');
    cacheInfo.forEach((entry, index) => {
      console.log(`[${index + 1}] ${entry.period} - ${entry.reports} reports - Age: ${entry.age} - ${entry.expired ? 'EXPIRED' : 'VALID'}`);
    });
    if (cacheInfo.length === 0) {
      console.log('[Mileage Cache] No cache entries found');
    }
    return cacheInfo;
  }

  // Debug function to check for pay period overlaps
  checkPayPeriodOverlaps() {
    try {
      const cacheInfo = this.getCacheInfo();
      const periods = [];
      
      console.log('[MileageCache DEBUG] Analyzing pay period overlaps...');
      
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
        console.warn(`[MileageCache DEBUG] Found ${overlaps.length} pay period overlaps:`);
        overlaps.forEach((overlap, index) => {
          console.warn(`  [${index + 1}] "${overlap.period1}" overlaps with "${overlap.period2}"`);
          console.warn(`       Key1: ${overlap.key1} (${overlap.reports1} reports)`);
          console.warn(`       Key2: ${overlap.key2} (${overlap.reports2} reports)`);
        });
      } else {
        console.log('[MileageCache DEBUG] No pay period overlaps detected');
      }
      
      return { periods, overlaps };
    } catch (error) {
      console.error('[MileageCache DEBUG] Error checking pay period overlaps:', error);
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
  console.log(`[MileageCacheService] Cleared ${clearedCount} cache entries due to pay period boundary fixes`);
}

// Add global debugging functions for browser console
if (typeof window !== 'undefined') {
  window.inspectMileageCache = () => mileageCacheService.inspectCache();
  window.checkMileagePayPeriodOverlaps = () => mileageCacheService.checkPayPeriodOverlaps();
  window.clearMileageCache = (organizationId) => {
    if (organizationId) {
      mileageCacheService.clearOrganizationCache(organizationId);
      console.log(`[Mileage Cache] Cleared cache for organization ${organizationId}`);
    } else {
      console.log('[Mileage Cache] Please provide organizationId: clearMileageCache("org-id")');
    }
  };
  window.forceClearAllMileageCache = () => {
    const cleared = mileageCacheService.clearAllMileageCache();
    console.log(`[Mileage Cache] Force cleared ${cleared} entries`);
    return cleared;
  };
}

export default mileageCacheService;