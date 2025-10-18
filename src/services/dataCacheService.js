// Centralized cache service for DataCacheContext data
class DataCacheService {
  constructor() {
    this.CACHE_VERSION = '1.0'; // Version for cache compatibility
    this.SESSIONS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - with real-time listeners for updates
    this.USERS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week - user data rarely changes
    this.TIMEOFF_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - match sessions for consistent loading
    this.TIMEENTRIES_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - needed for payroll/OT calculations
    this.DAILYJOB_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - match sessions for consistent loading
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

  // Time entries cache methods
  getCachedTimeEntries(organizationId) {
    try {
      const key = `datacache_timeentries_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);

      if (cacheData.version !== this.CACHE_VERSION ||
          Date.now() - cacheData.timestamp > this.TIMEENTRIES_CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached time entries:', error);
      return null;
    }
  }

  setCachedTimeEntries(organizationId, timeEntries) {
    try {
      const key = `datacache_timeentries_${organizationId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: timeEntries
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache time entries:', error);
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

  // Daily job reports cache methods
  getCachedDailyJobReports(organizationId) {
    try {
      const key = `datacache_dailyjob_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeData(cached);
      
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.DAILYJOB_CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached daily job reports:', error);
      return null;
    }
  }

  setCachedDailyJobReports(organizationId, reports) {
    try {
      const key = `datacache_dailyjob_${organizationId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: reports
      };
      localStorage.setItem(key, this.serializeData(cacheData));
    } catch (error) {
      console.warn('Failed to cache daily job reports:', error);
    }
  }

  // Clear specific cache types
  clearSessionsCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_sessions_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_sessions_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear sessions cache:', error);
    }
  }

  clearUsersCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_users_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_users_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear users cache:', error);
    }
  }

  clearTimeOffCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_timeoff_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_timeoff_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear time-off cache:', error);
    }
  }

  clearTimeEntriesCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_timeentries_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_timeentries_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear time entries cache:', error);
    }
  }

  clearDailyJobCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_dailyjob_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_dailyjob_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear daily job cache:', error);
    }
  }

  // Clear all caches for an organization
  clearCache(organizationId) {
    try {
      localStorage.removeItem(`datacache_sessions_${organizationId}`);
      localStorage.removeItem(`datacache_users_${organizationId}`);
      localStorage.removeItem(`datacache_timeoff_${organizationId}`);
      localStorage.removeItem(`datacache_timeentries_${organizationId}`);
      localStorage.removeItem(`datacache_dailyjob_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_sessions_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_users_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_timeoff_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_timeentries_${organizationId}`);
      localStorage.removeItem(`datacache_lastsync_dailyjob_${organizationId}`);
    } catch (error) {
      console.warn('Failed to clear data cache:', error);
    }
  }
}

const dataCacheService = new DataCacheService();
export default dataCacheService;