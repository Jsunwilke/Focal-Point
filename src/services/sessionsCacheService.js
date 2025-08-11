// Sessions cache service to reduce duplicate queries
class SessionsCacheService {
  constructor() {
    this.CACHE_VERSION = '1.0';
    this.CACHE_DURATION = 10 * 60 * 1000; // 10 minutes - sessions don't change frequently
    this.SESSIONS_KEY_PREFIX = 'sessions_list_';
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

  // Get cache key for sessions list
  getSessionsKey(organizationId, startDate = null, endDate = null) {
    const dateRange = startDate && endDate ? `${startDate}_${endDate}` : 'all';
    return `${this.SESSIONS_KEY_PREFIX}${organizationId}_${dateRange}`;
  }

  // Get cached sessions
  getCachedSessions(organizationId, startDate = null, endDate = null) {
    try {
      const key = this.getSessionsKey(organizationId, startDate, endDate);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      return null;
    }
  }

  // Cache sessions
  setCachedSessions(organizationId, sessions, startDate = null, endDate = null) {
    try {
      const key = this.getSessionsKey(organizationId, startDate, endDate);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: sessions
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
    }
  }

  // Clear all sessions caches for an organization
  clearOrganizationCache(organizationId) {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.SESSIONS_KEY_PREFIX) && key.includes(organizationId)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
    }
  }

  // Clear expired caches
  clearExpiredCaches() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith(this.SESSIONS_KEY_PREFIX)) {
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
      const sessionsCaches = [];
      
      keys.forEach(key => {
        if (key.startsWith(this.SESSIONS_KEY_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData = this.deserializeData(cached);
              const age = Date.now() - cacheData.timestamp;
              sessionsCaches.push({
                key: key,
                age: Math.round(age / 1000 / 60) + ' minutes',
                size: cached.length,
                expired: age > this.CACHE_DURATION,
                sessionCount: cacheData.data ? cacheData.data.length : 0
              });
            }
          } catch (error) {
            // Skip corrupted entries
          }
        }
      });
      
      return sessionsCaches;
    } catch (error) {
      return [];
    }
  }
}

const sessionsCacheService = new SessionsCacheService();

// Run cleanup on initialization
sessionsCacheService.clearExpiredCaches();

export default sessionsCacheService;