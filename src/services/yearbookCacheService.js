// src/services/yearbookCacheService.js
import { readCounter } from './readCounter';
import secureLogger from '../utils/secureLogger';

class YearbookCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_yearbook_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.MAX_ITEMS_PER_LIST = 200; // Limit items per list
    this.MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5MB max for yearbook data
  }

  // Generate cache key for a specific school and year
  getCacheKey(schoolId, schoolYear) {
    return `${this.CACHE_PREFIX}${schoolId}_${schoolYear}_v${this.CACHE_VERSION}`;
  }

  // Generate cache key for templates
  getTemplateCacheKey(organizationId) {
    return `${this.CACHE_PREFIX}templates_${organizationId}_v${this.CACHE_VERSION}`;
  }

  // Generate cache key for available years
  getYearsCacheKey(schoolId) {
    return `${this.CACHE_PREFIX}years_${schoolId}_v${this.CACHE_VERSION}`;
  }

  // Check if cache is valid
  isValidCache(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    
    const age = Date.now() - cachedData.timestamp;
    return age < this.MAX_CACHE_AGE;
  }

  // Get cached shoot list
  getCachedShootList(schoolId, schoolYear) {
    try {
      const cacheKey = this.getCacheKey(schoolId, schoolYear);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached);
      
      if (!this.isValidCache(data)) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Convert stored date strings back to Date objects
      if (data.shootList) {
        data.shootList = this.deserializeDates(data.shootList);
      }

      return data.shootList;
    } catch (error) {
      secureLogger.error('Error reading yearbook cache:', error);
      return null;
    }
  }

  // Set cached shoot list
  setCachedShootList(schoolId, schoolYear, shootList) {
    try {
      const cacheKey = this.getCacheKey(schoolId, schoolYear);
      
      // Limit items to prevent excessive cache size
      if (shootList.items && shootList.items.length > this.MAX_ITEMS_PER_LIST) {
        secureLogger.warn(`Shoot list has ${shootList.items.length} items, limiting to ${this.MAX_ITEMS_PER_LIST}`);
        shootList.items = shootList.items.slice(0, this.MAX_ITEMS_PER_LIST);
      }

      const cacheData = {
        shootList: this.serializeDates(shootList),
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      const serialized = JSON.stringify(cacheData);
      
      // Check size before storing
      if (serialized.length > this.MAX_CACHE_SIZE) {
        secureLogger.error('Yearbook cache data too large, not caching');
        return false;
      }

      localStorage.setItem(cacheKey, serialized);
      this.cleanupOldCache();
      
      return true;
    } catch (error) {
      secureLogger.error('Error setting yearbook cache:', error);
      return false;
    }
  }

  // Get cached available years for a school
  getCachedYears(schoolId) {
    try {
      const cacheKey = this.getYearsCacheKey(schoolId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;

      const data = JSON.parse(cached);
      
      if (!this.isValidCache(data)) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data.years;
    } catch (error) {
      secureLogger.error('Error reading years cache:', error);
      return null;
    }
  }

  // Set cached available years
  setCachedYears(schoolId, years) {
    try {
      const cacheKey = this.getYearsCacheKey(schoolId);
      const cacheData = {
        years,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      secureLogger.error('Error setting years cache:', error);
      return false;
    }
  }

  // Get cached templates
  getCachedTemplates(organizationId) {
    try {
      const cacheKey = this.getTemplateCacheKey(organizationId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;

      const data = JSON.parse(cached);
      
      if (!this.isValidCache(data)) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return data.templates;
    } catch (error) {
      secureLogger.error('Error reading templates cache:', error);
      return null;
    }
  }

  // Set cached templates
  setCachedTemplates(organizationId, templates) {
    try {
      const cacheKey = this.getTemplateCacheKey(organizationId);
      const cacheData = {
        templates,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      secureLogger.error('Error setting templates cache:', error);
      return false;
    }
  }

  // Get latest timestamp from cached data
  getLatestTimestamp(schoolId, schoolYear) {
    const cached = this.getCachedShootList(schoolId, schoolYear);
    if (!cached || !cached.updatedAt) return null;
    
    // Convert to Date object if it's not already
    if (cached.updatedAt instanceof Date) {
      return cached.updatedAt;
    }
    
    const date = new Date(cached.updatedAt);
    return isNaN(date.getTime()) ? null : date;
  }

  // Update specific items in cache
  updateCachedItems(schoolId, schoolYear, itemUpdates) {
    try {
      const cached = this.getCachedShootList(schoolId, schoolYear);
      if (!cached) return false;

      // Apply updates to cached items
      let completedCountDelta = 0;
      const updatedItems = cached.items.map(item => {
        const update = itemUpdates.find(u => u.itemId === item.id);
        if (update) {
          const wasCompleted = item.completed;
          const isNowCompleted = update.updates.completed !== undefined ? update.updates.completed : item.completed;
          
          if (!wasCompleted && isNowCompleted) {
            completedCountDelta++;
          } else if (wasCompleted && !isNowCompleted) {
            completedCountDelta--;
          }
          
          return { ...item, ...update.updates };
        }
        return item;
      });

      cached.items = updatedItems;
      cached.completedCount = Math.max(0, (cached.completedCount || 0) + completedCountDelta);
      cached.updatedAt = new Date();

      return this.setCachedShootList(schoolId, schoolYear, cached);
    } catch (error) {
      secureLogger.error('Error updating cached items:', error);
      return false;
    }
  }

  // Clear cache for specific school and year
  clearCache(schoolId, schoolYear) {
    try {
      const cacheKey = this.getCacheKey(schoolId, schoolYear);
      localStorage.removeItem(cacheKey);
      return true;
    } catch (error) {
      secureLogger.error('Error clearing yearbook cache:', error);
      return false;
    }
  }

  // Clear all yearbook caches
  clearAllCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      secureLogger.error('Error clearing all yearbook cache:', error);
      return false;
    }
  }

  // Cleanup old cache entries
  cleanupOldCache() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      let removedCount = 0;

      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.timestamp && (now - data.timestamp) > this.MAX_CACHE_AGE) {
              localStorage.removeItem(key);
              removedCount++;
            }
          } catch (e) {
            // Invalid data, remove it
            localStorage.removeItem(key);
            removedCount++;
          }
        }
      });

      if (removedCount > 0) {
        secureLogger.log(`Cleaned up ${removedCount} old yearbook cache entries`);
      }
    } catch (error) {
      secureLogger.error('Error cleaning up yearbook cache:', error);
    }
  }

  // Serialize dates for storage
  serializeDates(obj) {
    if (!obj) return obj;
    
    const serialized = { ...obj };
    
    // Convert Date objects to ISO strings
    ['createdAt', 'updatedAt', 'startDate', 'endDate'].forEach(field => {
      if (serialized[field]) {
        // Handle both Date objects and Firebase Timestamps
        if (serialized[field].toDate) {
          serialized[field] = serialized[field].toDate().toISOString();
        } else if (serialized[field] instanceof Date) {
          serialized[field] = serialized[field].toISOString();
        }
      }
    });

    // Handle dates in items array
    if (serialized.items && Array.isArray(serialized.items)) {
      serialized.items = serialized.items.map(item => {
        const serializedItem = { ...item };
        if (serializedItem.completedDate) {
          // Handle both Date objects and Firebase Timestamps
          if (serializedItem.completedDate.toDate) {
            serializedItem.completedDate = serializedItem.completedDate.toDate().toISOString();
          } else if (serializedItem.completedDate instanceof Date) {
            serializedItem.completedDate = serializedItem.completedDate.toISOString();
          }
        }
        return serializedItem;
      });
    }

    return serialized;
  }

  // Deserialize dates from storage
  deserializeDates(obj) {
    if (!obj) return obj;
    
    const deserialized = { ...obj };
    
    // Convert ISO strings back to Date objects
    ['createdAt', 'updatedAt', 'startDate', 'endDate'].forEach(field => {
      if (deserialized[field] && typeof deserialized[field] === 'string') {
        const date = new Date(deserialized[field]);
        if (!isNaN(date.getTime())) {
          deserialized[field] = date;
        }
      }
    });

    // Handle dates in items array
    if (deserialized.items && Array.isArray(deserialized.items)) {
      deserialized.items = deserialized.items.map(item => {
        const deserializedItem = { ...item };
        if (deserializedItem.completedDate && typeof deserializedItem.completedDate === 'string') {
          const date = new Date(deserializedItem.completedDate);
          if (!isNaN(date.getTime())) {
            deserializedItem.completedDate = date;
          }
        }
        return deserializedItem;
      });
    }

    return deserialized;
  }

  // Get cache statistics
  getCacheStats() {
    try {
      const keys = Object.keys(localStorage);
      const yearbookKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      let totalSize = 0;
      let oldestCache = null;
      let newestCache = null;
      
      yearbookKeys.forEach(key => {
        const data = localStorage.getItem(key);
        totalSize += data.length;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            if (!oldestCache || parsed.timestamp < oldestCache) {
              oldestCache = parsed.timestamp;
            }
            if (!newestCache || parsed.timestamp > newestCache) {
              newestCache = parsed.timestamp;
            }
          }
        } catch (e) {
          // Skip invalid entries
        }
      });

      return {
        cacheCount: yearbookKeys.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        oldestCacheDate: oldestCache ? new Date(oldestCache) : null,
        newestCacheDate: newestCache ? new Date(newestCache) : null
      };
    } catch (error) {
      secureLogger.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
const yearbookCacheService = new YearbookCacheService();
export default yearbookCacheService;