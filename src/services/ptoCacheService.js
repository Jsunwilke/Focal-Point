import { Timestamp } from 'firebase/firestore';

class PTOCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_pto_';
    this.CACHE_VERSION = '1.0';
    this.PTO_CACHE_AGE = 4 * 60 * 60 * 1000; // 4 hours for PTO data
    this.BLOCKED_DATES_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours for blocked dates
  }

  // PTO requests cache key
  getPTORequestsKey(organizationId) {
    return `${this.CACHE_PREFIX}requests_${organizationId}`;
  }

  // User PTO requests cache key
  getUserPTORequestsKey(userId) {
    return `${this.CACHE_PREFIX}user_requests_${userId}`;
  }

  // Blocked dates cache key
  getBlockedDatesKey(organizationId) {
    return `${this.CACHE_PREFIX}blocked_dates_${organizationId}`;
  }

  // PTO balances cache key
  getPTOBalancesKey(organizationId) {
    return `${this.CACHE_PREFIX}balances_${organizationId}`;
  }

  // Cache PTO requests
  setCachedPTORequests(organizationId, requests) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: requests.map(req => this.serializePTORequest(req))
      };
      localStorage.setItem(this.getPTORequestsKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache PTO requests:', error);
    }
  }

  // Get cached PTO requests
  getCachedPTORequests(organizationId) {
    try {
      const key = this.getPTORequestsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.PTO_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize requests
      return cacheData.data.map(req => this.deserializePTORequest(req));
    } catch (error) {
      console.warn('Failed to retrieve cached PTO requests:', error);
      return null;
    }
  }

  // Cache user PTO requests
  setCachedUserPTORequests(userId, requests) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        userId,
        data: requests.map(req => this.serializePTORequest(req))
      };
      localStorage.setItem(this.getUserPTORequestsKey(userId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache user PTO requests:', error);
    }
  }

  // Get cached user PTO requests
  getCachedUserPTORequests(userId) {
    try {
      const key = this.getUserPTORequestsKey(userId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.PTO_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize requests
      return cacheData.data.map(req => this.deserializePTORequest(req));
    } catch (error) {
      console.warn('Failed to retrieve cached user PTO requests:', error);
      return null;
    }
  }

  // Cache blocked dates
  setCachedBlockedDates(organizationId, blockedDates) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: blockedDates.map(date => this.serializeBlockedDate(date))
      };
      localStorage.setItem(this.getBlockedDatesKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache blocked dates:', error);
    }
  }

  // Get cached blocked dates
  getCachedBlockedDates(organizationId) {
    try {
      const key = this.getBlockedDatesKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.BLOCKED_DATES_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize blocked dates
      return cacheData.data.map(date => this.deserializeBlockedDate(date));
    } catch (error) {
      console.warn('Failed to retrieve cached blocked dates:', error);
      return null;
    }
  }

  // Cache PTO balances
  setCachedPTOBalances(organizationId, balances) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: balances
      };
      localStorage.setItem(this.getPTOBalancesKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache PTO balances:', error);
    }
  }

  // Get cached PTO balances
  getCachedPTOBalances(organizationId) {
    try {
      const key = this.getPTOBalancesKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.PTO_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached PTO balances:', error);
      return null;
    }
  }

  // Update single PTO request in cache
  updateCachedPTORequest(organizationId, updatedRequest) {
    try {
      const cachedRequests = this.getCachedPTORequests(organizationId);
      if (!cachedRequests) return;

      const index = cachedRequests.findIndex(req => req.id === updatedRequest.id);
      if (index !== -1) {
        cachedRequests[index] = updatedRequest;
        this.setCachedPTORequests(organizationId, cachedRequests);
      }

      // Also update user-specific cache if applicable
      const userRequests = this.getCachedUserPTORequests(updatedRequest.userId);
      if (userRequests) {
        const userIndex = userRequests.findIndex(req => req.id === updatedRequest.id);
        if (userIndex !== -1) {
          userRequests[userIndex] = updatedRequest;
          this.setCachedUserPTORequests(updatedRequest.userId, userRequests);
        }
      }
    } catch (error) {
      console.warn('Failed to update cached PTO request:', error);
    }
  }

  // Remove PTO request from cache
  removeCachedPTORequest(organizationId, requestId, userId) {
    try {
      // Remove from organization cache
      const cachedRequests = this.getCachedPTORequests(organizationId);
      if (cachedRequests) {
        const filteredRequests = cachedRequests.filter(req => req.id !== requestId);
        this.setCachedPTORequests(organizationId, filteredRequests);
      }

      // Remove from user cache if userId provided
      if (userId) {
        const userRequests = this.getCachedUserPTORequests(userId);
        if (userRequests) {
          const filteredUserRequests = userRequests.filter(req => req.id !== requestId);
          this.setCachedUserPTORequests(userId, filteredUserRequests);
        }
      }
    } catch (error) {
      console.warn('Failed to remove cached PTO request:', error);
    }
  }

  // Clear specific caches
  clearPTORequestsCache(organizationId) {
    try {
      localStorage.removeItem(this.getPTORequestsKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear PTO requests cache:', error);
    }
  }

  clearUserPTORequestsCache(userId) {
    try {
      localStorage.removeItem(this.getUserPTORequestsKey(userId));
    } catch (error) {
      console.warn('Failed to clear user PTO requests cache:', error);
    }
  }

  clearBlockedDatesCache(organizationId) {
    try {
      localStorage.removeItem(this.getBlockedDatesKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear blocked dates cache:', error);
    }
  }

  clearPTOBalancesCache(organizationId) {
    try {
      localStorage.removeItem(this.getPTOBalancesKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear PTO balances cache:', error);
    }
  }

  // Serialize PTO request for storage
  serializePTORequest(request) {
    try {
      const serialized = { ...request };
      
      // Convert Timestamp fields
      const timestampFields = ['startDate', 'endDate', 'createdAt', 'updatedAt', 'approvedAt', 'deniedAt'];
      timestampFields.forEach(field => {
        if (serialized[field] && serialized[field].toMillis) {
          serialized[field] = {
            _isTimestamp: true,
            seconds: serialized[field].seconds,
            nanoseconds: serialized[field].nanoseconds
          };
        }
      });

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize PTO request:', error);
      return request;
    }
  }

  // Deserialize PTO request from storage
  deserializePTORequest(request) {
    try {
      const deserialized = { ...request };
      
      // Restore Timestamp fields
      const timestampFields = ['startDate', 'endDate', 'createdAt', 'updatedAt', 'approvedAt', 'deniedAt'];
      timestampFields.forEach(field => {
        if (deserialized[field]?._isTimestamp) {
          deserialized[field] = new Timestamp(
            deserialized[field].seconds,
            deserialized[field].nanoseconds
          );
        }
      });

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize PTO request:', error);
      return request;
    }
  }

  // Serialize blocked date for storage
  serializeBlockedDate(blockedDate) {
    try {
      const serialized = { ...blockedDate };
      
      // Convert date Timestamp
      if (serialized.date && serialized.date.toMillis) {
        serialized.date = {
          _isTimestamp: true,
          seconds: serialized.date.seconds,
          nanoseconds: serialized.date.nanoseconds
        };
      }

      // Convert createdAt Timestamp
      if (serialized.createdAt && serialized.createdAt.toMillis) {
        serialized.createdAt = {
          _isTimestamp: true,
          seconds: serialized.createdAt.seconds,
          nanoseconds: serialized.createdAt.nanoseconds
        };
      }

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize blocked date:', error);
      return blockedDate;
    }
  }

  // Deserialize blocked date from storage
  deserializeBlockedDate(blockedDate) {
    try {
      const deserialized = { ...blockedDate };
      
      // Restore date Timestamp
      if (deserialized.date?._isTimestamp) {
        deserialized.date = new Timestamp(
          deserialized.date.seconds,
          deserialized.date.nanoseconds
        );
      }

      // Restore createdAt Timestamp
      if (deserialized.createdAt?._isTimestamp) {
        deserialized.createdAt = new Timestamp(
          deserialized.createdAt.seconds,
          deserialized.createdAt.nanoseconds
        );
      }

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize blocked date:', error);
      return blockedDate;
    }
  }

  // Get cache statistics
  getCacheStats(organizationId) {
    try {
      const ptoRequests = this.getCachedPTORequests(organizationId);
      const blockedDates = this.getCachedBlockedDates(organizationId);
      const balances = this.getCachedPTOBalances(organizationId);
      
      return {
        hasCachedPTORequests: !!ptoRequests,
        ptoRequestCount: ptoRequests ? ptoRequests.length : 0,
        hasCachedBlockedDates: !!blockedDates,
        blockedDateCount: blockedDates ? blockedDates.length : 0,
        hasCachedBalances: !!balances
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        hasCachedPTORequests: false,
        ptoRequestCount: 0,
        hasCachedBlockedDates: false,
        blockedDateCount: 0,
        hasCachedBalances: false
      };
    }
  }

  // Clear all PTO caches
  clearAllPTOCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} PTO cache items`);
    } catch (error) {
      console.warn('Failed to clear all PTO caches:', error);
    }
  }
}

// Create singleton instance
export const ptoCacheService = new PTOCacheService();
export default ptoCacheService;