// Time entry cache service to reduce duplicate queries
class TimeEntryCacheService {
  constructor() {
    this.CACHE_VERSION = '1.0';
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.USER_ENTRIES_KEY = 'timeentries_user_';
    this.ORG_ENTRIES_KEY = 'timeentries_org_';
    this.SESSION_STATS_KEY = 'session_stats_';
    this.SCHOOL_STATS_KEY = 'school_stats_';
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

  // Get cache key for user time entries
  getUserEntriesKey(userId, organizationId, startDate, endDate) {
    return `${this.USER_ENTRIES_KEY}${userId}_${organizationId}_${startDate || 'all'}_${endDate || 'all'}`;
  }

  // Get cache key for organization time entries
  getOrgEntriesKey(organizationId, startDate, endDate) {
    return `${this.ORG_ENTRIES_KEY}${organizationId}_${startDate || 'all'}_${endDate || 'all'}`;
  }

  // Get cache key for session stats
  getSessionStatsKey(userId, organizationId, startDate, endDate) {
    return `${this.SESSION_STATS_KEY}${userId}_${organizationId}_${startDate || 'all'}_${endDate || 'all'}`;
  }

  // Get cache key for school stats
  getSchoolStatsKey(userId, organizationId, startDate, endDate) {
    return `${this.SCHOOL_STATS_KEY}${userId}_${organizationId}_${startDate || 'all'}_${endDate || 'all'}`;
  }

  // Get cached user time entries
  getCachedUserEntries(userId, organizationId, startDate, endDate) {
    try {
      const key = this.getUserEntriesKey(userId, organizationId, startDate, endDate);
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
      console.warn('Failed to retrieve cached user entries:', error);
      return null;
    }
  }

  // Cache user time entries
  setCachedUserEntries(userId, organizationId, startDate, endDate, entries) {
    try {
      const key = this.getUserEntriesKey(userId, organizationId, startDate, endDate);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: entries
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache user entries:', error);
    }
  }

  // Get cached organization time entries
  getCachedOrgEntries(organizationId, startDate, endDate) {
    try {
      const key = this.getOrgEntriesKey(organizationId, startDate, endDate);
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
      console.warn('Failed to retrieve cached org entries:', error);
      return null;
    }
  }

  // Cache organization time entries
  setCachedOrgEntries(organizationId, startDate, endDate, entries) {
    try {
      const key = this.getOrgEntriesKey(organizationId, startDate, endDate);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: entries
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache org entries:', error);
    }
  }

  // Get cached session stats
  getCachedSessionStats(userId, organizationId, startDate, endDate) {
    try {
      const key = this.getSessionStatsKey(userId, organizationId, startDate, endDate);
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
      console.warn('Failed to retrieve cached session stats:', error);
      return null;
    }
  }

  // Cache session stats
  setCachedSessionStats(userId, organizationId, startDate, endDate, stats) {
    try {
      const key = this.getSessionStatsKey(userId, organizationId, startDate, endDate);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: stats
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache session stats:', error);
    }
  }

  // Get cached school stats
  getCachedSchoolStats(userId, organizationId, startDate, endDate) {
    try {
      const key = this.getSchoolStatsKey(userId, organizationId, startDate, endDate);
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
      console.warn('Failed to retrieve cached school stats:', error);
      return null;
    }
  }

  // Cache school stats
  setCachedSchoolStats(userId, organizationId, startDate, endDate, stats) {
    try {
      const key = this.getSchoolStatsKey(userId, organizationId, startDate, endDate);
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: stats
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache school stats:', error);
    }
  }

  // Clear all time entry caches
  clearCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.USER_ENTRIES_KEY) || 
            key.startsWith(this.ORG_ENTRIES_KEY) ||
            key.startsWith(this.SESSION_STATS_KEY) ||
            key.startsWith(this.SCHOOL_STATS_KEY)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear time entry cache:', error);
    }
  }

  // Clear expired caches
  clearExpiredCaches() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.USER_ENTRIES_KEY) || 
            key.startsWith(this.ORG_ENTRIES_KEY) ||
            key.startsWith(this.SESSION_STATS_KEY) ||
            key.startsWith(this.SCHOOL_STATS_KEY)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData = this.deserializeData(cached);
              if (cacheData.version !== this.CACHE_VERSION || 
                  now - cacheData.timestamp > this.CACHE_DURATION) {
                localStorage.removeItem(key);
              }
            }
          } catch (error) {
            // Remove corrupted cache entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to clear expired caches:', error);
    }
  }
}

const timeEntryCacheService = new TimeEntryCacheService();
export default timeEntryCacheService;