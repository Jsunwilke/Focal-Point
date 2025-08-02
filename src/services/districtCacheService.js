// src/services/districtCacheService.js
import { readCounter } from './readCounter';

class DistrictCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_districts_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB limit for district data
  }

  // Generate cache key for districts
  getCacheKey(organizationId) {
    return `${this.CACHE_PREFIX}${organizationId}_v${this.CACHE_VERSION}`;
  }

  // Get cached districts for an organization
  getCachedDistricts(organizationId) {
    try {
      const cacheKey = this.getCacheKey(organizationId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const { data, timestamp, version } = JSON.parse(cached);
      
      // Check version
      if (version !== this.CACHE_VERSION) {
        this.clearOrganizationCache(organizationId);
        return null;
      }
      
      // Check age
      const age = Date.now() - timestamp;
      if (age > this.MAX_CACHE_AGE) {
        this.clearOrganizationCache(organizationId);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error reading districts from cache:', error);
      return null;
    }
  }

  // Set cached districts for an organization
  setCachedDistricts(organizationId, districts) {
    try {
      const cacheKey = this.getCacheKey(organizationId);
      const cacheData = {
        data: districts,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };
      
      const serialized = JSON.stringify(cacheData);
      
      // Check size limit
      if (serialized.length > this.MAX_CACHE_SIZE) {
        console.warn('Districts cache data exceeds size limit');
        return;
      }
      
      localStorage.setItem(cacheKey, serialized);
    } catch (error) {
      console.error('Error writing districts to cache:', error);
      // Clear cache on error to prevent corruption
      this.clearOrganizationCache(organizationId);
    }
  }

  // Get cached schools by district
  getCachedSchoolsByDistrict(districtId) {
    try {
      const cacheKey = `${this.CACHE_PREFIX}schools_by_district_${districtId}_v${this.CACHE_VERSION}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const { data, timestamp } = JSON.parse(cached);
      
      // Check age (shorter TTL for filtered data)
      const age = Date.now() - timestamp;
      if (age > 60 * 60 * 1000) { // 1 hour
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error reading schools by district from cache:', error);
      return null;
    }
  }

  // Set cached schools by district
  setCachedSchoolsByDistrict(districtId, schools) {
    try {
      const cacheKey = `${this.CACHE_PREFIX}schools_by_district_${districtId}_v${this.CACHE_VERSION}`;
      const cacheData = {
        data: schools,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching schools by district:', error);
    }
  }

  // Clear cache for a specific organization
  clearOrganizationCache(organizationId) {
    try {
      const cacheKey = this.getCacheKey(organizationId);
      localStorage.removeItem(cacheKey);
      
      // Also clear any related school-by-district caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(`${this.CACHE_PREFIX}schools_by_district_`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing districts cache:', error);
    }
  }

  // Clear all district caches
  clearAllCaches() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing all district caches:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    const stats = {
      totalSize: 0,
      districtCaches: 0,
      schoolByDistrictCaches: 0,
      oldestCache: null,
      newestCache: null
    };

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            stats.totalSize += value.length;
            
            if (key.includes('schools_by_district_')) {
              stats.schoolByDistrictCaches++;
            } else {
              stats.districtCaches++;
            }
            
            try {
              const { timestamp } = JSON.parse(value);
              if (!stats.oldestCache || timestamp < stats.oldestCache) {
                stats.oldestCache = timestamp;
              }
              if (!stats.newestCache || timestamp > stats.newestCache) {
                stats.newestCache = timestamp;
              }
            } catch (e) {
              // Skip invalid entries
            }
          }
        }
      });
    } catch (error) {
      console.error('Error calculating cache stats:', error);
    }

    return stats;
  }
}

// Export singleton instance
export const districtCacheService = new DistrictCacheService();