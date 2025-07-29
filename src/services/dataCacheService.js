// Centralized cache service for DataCacheContext data
class DataCacheService {
  constructor() {
    this.CACHE_VERSION = '1.1'; // Increment version to invalidate old caches
    this.SESSIONS_CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours - employees come and go frequently
    this.USERS_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours - user data changes less often
    this.TIMEOFF_CACHE_DURATION = 60 * 60 * 1000; // 1 hour - time off requests moderate change rate
  }

  // Helper to serialize timestamps and dates
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

  // Helper to deserialize timestamps and dates
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

  // Sessions cache methods
  getCachedSessions(organizationId) {
    try {
      const key = `datacache_sessions_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);
      
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.SESSIONS_CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached sessions:', error);
      return null;
    }
  }

  setCachedSessions(organizationId, sessions) {
    try {
      const key = `datacache_sessions_${organizationId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: sessions
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache sessions:', error);
    }
  }

  // Users cache methods
  getCachedUsers(organizationId) {
    try {
      const key = `datacache_users_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);
      
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.USERS_CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached users:', error);
      return null;
    }
  }

  setCachedUsers(organizationId, users) {
    try {
      const key = `datacache_users_${organizationId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: users
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache users:', error);
    }
  }

  // Time-off requests cache methods
  getCachedTimeOffRequests(organizationId) {
    try {
      const key = `datacache_timeoff_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);
      
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TIMEOFF_CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached time-off requests:', error);
      return null;
    }
  }

  setCachedTimeOffRequests(organizationId, requests) {
    try {
      const key = `datacache_timeoff_${organizationId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: requests
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache time-off requests:', error);
    }
  }

  // Get last sync timestamp for incremental updates
  getLastSyncTime(organizationId, dataType) {
    try {
      const key = `datacache_lastsync_${dataType}_${organizationId}`;
      const timestamp = localStorage.getItem(key);
      return timestamp ? new Date(parseInt(timestamp)) : null;
    } catch (error) {
      console.warn('Failed to get last sync time:', error);
      return null;
    }
  }

  setLastSyncTime(organizationId, dataType) {
    try {
      const key = `datacache_lastsync_${dataType}_${organizationId}`;
      localStorage.setItem(key, Date.now().toString());
    } catch (error) {
      console.warn('Failed to set last sync time:', error);
    }
  }

  // Clear all caches for an organization
  clearCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_sessions_${organizationId}`);
      localStorage.removeItem(`datacache_users_${organizationId}`);
      localStorage.removeItem(`datacache_timeoff_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_sessions_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_users_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_timeoff_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear data cache:', error);
    }
  }
}

const dataCacheService = new DataCacheService();
export default dataCacheService;