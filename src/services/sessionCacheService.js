// Session cache service to reduce individual session reads
class SessionCacheService {
  constructor() {
    this.CACHE_VERSION = '1.0';
    this.CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
    this.SESSION_KEY_PREFIX = 'session_cache_';
  }

  // Helper to serialize timestamps
  serializeSession(session) {
    return JSON.stringify(session, (key, value) => {
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
  deserializeSession(json) {
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

  // Get cached session by ID
  getCachedSession(sessionId) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = this.deserializeSession(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached session:', error);
      return null;
    }
  }

  // Cache a single session
  setCachedSession(sessionId, session) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: session
      };
      localStorage.setItem(key, this.serializeSession(cacheData));
    } catch (error) {
      console.warn('Failed to cache session:', error);
    }
  }

  // Get multiple cached sessions
  getCachedSessions(sessionIds) {
    const cachedSessions = {};
    const missingIds = [];

    sessionIds.forEach(id => {
      const cached = this.getCachedSession(id);
      if (cached) {
        cachedSessions[id] = cached;
      } else {
        missingIds.push(id);
      }
    });

    return { cachedSessions, missingIds };
  }

  // Cache multiple sessions
  setCachedSessions(sessions) {
    Object.entries(sessions).forEach(([id, session]) => {
      this.setCachedSession(id, session);
    });
  }

  // Clear a specific session from cache
  clearCachedSession(sessionId) {
    try {
      const key = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear cached session:', error);
    }
  }

  // Clear session cache
  clearCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.SESSION_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear session cache:', error);
    }
  }

  // Clear expired sessions
  clearExpiredSessions() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.SESSION_KEY_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const cacheData = this.deserializeSession(cached);
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
      console.warn('Failed to clear expired sessions:', error);
    }
  }
}

const sessionCacheService = new SessionCacheService();
export default sessionCacheService;