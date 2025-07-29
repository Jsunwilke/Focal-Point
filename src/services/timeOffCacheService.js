import { Timestamp } from 'firebase/firestore';

class TimeOffCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_timeoff_';
    this.CACHE_VERSION = '1.0';
    this.TIMEOFF_CACHE_AGE = 2 * 60 * 60 * 1000; // 2 hours for time off data
    this.APPROVALS_CACHE_AGE = 30 * 60 * 1000; // 30 minutes for pending approvals
  }

  // Time off requests cache key
  getTimeOffRequestsKey(organizationId) {
    return `${this.CACHE_PREFIX}requests_${organizationId}`;
  }

  // User time off requests cache key
  getUserTimeOffRequestsKey(userId) {
    return `${this.CACHE_PREFIX}user_requests_${userId}`;
  }

  // Pending approvals cache key
  getPendingApprovalsKey(approverId) {
    return `${this.CACHE_PREFIX}pending_approvals_${approverId}`;
  }

  // Time off balances cache key
  getTimeOffBalancesKey(userId) {
    return `${this.CACHE_PREFIX}balances_${userId}`;
  }

  // Cache time off requests
  setCachedTimeOffRequests(organizationId, requests) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: requests.map(req => this.serializeTimeOffRequest(req))
      };
      localStorage.setItem(this.getTimeOffRequestsKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache time off requests:', error);
    }
  }

  // Get cached time off requests
  getCachedTimeOffRequests(organizationId) {
    try {
      const key = this.getTimeOffRequestsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TIMEOFF_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize requests
      return cacheData.data.map(req => this.deserializeTimeOffRequest(req));
    } catch (error) {
      console.warn('Failed to retrieve cached time off requests:', error);
      return null;
    }
  }

  // Cache user time off requests
  setCachedUserTimeOffRequests(userId, requests) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        userId,
        data: requests.map(req => this.serializeTimeOffRequest(req))
      };
      localStorage.setItem(this.getUserTimeOffRequestsKey(userId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache user time off requests:', error);
    }
  }

  // Get cached user time off requests
  getCachedUserTimeOffRequests(userId) {
    try {
      const key = this.getUserTimeOffRequestsKey(userId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TIMEOFF_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize requests
      return cacheData.data.map(req => this.deserializeTimeOffRequest(req));
    } catch (error) {
      console.warn('Failed to retrieve cached user time off requests:', error);
      return null;
    }
  }

  // Cache pending approvals
  setCachedPendingApprovals(approverId, approvals) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        approverId,
        data: approvals.map(req => this.serializeTimeOffRequest(req))
      };
      localStorage.setItem(this.getPendingApprovalsKey(approverId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache pending approvals:', error);
    }
  }

  // Get cached pending approvals
  getCachedPendingApprovals(approverId) {
    try {
      const key = this.getPendingApprovalsKey(approverId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age (shorter for pending approvals)
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.APPROVALS_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize approvals
      return cacheData.data.map(req => this.deserializeTimeOffRequest(req));
    } catch (error) {
      console.warn('Failed to retrieve cached pending approvals:', error);
      return null;
    }
  }

  // Cache time off balances
  setCachedTimeOffBalances(userId, balances) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        userId,
        data: balances
      };
      localStorage.setItem(this.getTimeOffBalancesKey(userId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache time off balances:', error);
    }
  }

  // Get cached time off balances
  getCachedTimeOffBalances(userId) {
    try {
      const key = this.getTimeOffBalancesKey(userId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.TIMEOFF_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached time off balances:', error);
      return null;
    }
  }

  // Update single time off request in cache
  updateCachedTimeOffRequest(organizationId, updatedRequest) {
    try {
      // Update organization cache
      const cachedRequests = this.getCachedTimeOffRequests(organizationId);
      if (cachedRequests) {
        const index = cachedRequests.findIndex(req => req.id === updatedRequest.id);
        if (index !== -1) {
          cachedRequests[index] = updatedRequest;
          this.setCachedTimeOffRequests(organizationId, cachedRequests);
        }
      }

      // Update user-specific cache
      const userRequests = this.getCachedUserTimeOffRequests(updatedRequest.userId);
      if (userRequests) {
        const userIndex = userRequests.findIndex(req => req.id === updatedRequest.id);
        if (userIndex !== -1) {
          userRequests[userIndex] = updatedRequest;
          this.setCachedUserTimeOffRequests(updatedRequest.userId, userRequests);
        }
      }

      // Update pending approvals cache if applicable
      if (updatedRequest.status === 'pending' && updatedRequest.approverId) {
        const pendingApprovals = this.getCachedPendingApprovals(updatedRequest.approverId);
        if (pendingApprovals) {
          const approvalIndex = pendingApprovals.findIndex(req => req.id === updatedRequest.id);
          if (approvalIndex !== -1) {
            pendingApprovals[approvalIndex] = updatedRequest;
            this.setCachedPendingApprovals(updatedRequest.approverId, pendingApprovals);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to update cached time off request:', error);
    }
  }

  // Remove time off request from cache
  removeCachedTimeOffRequest(organizationId, requestId, userId, approverId) {
    try {
      // Remove from organization cache
      const cachedRequests = this.getCachedTimeOffRequests(organizationId);
      if (cachedRequests) {
        const filteredRequests = cachedRequests.filter(req => req.id !== requestId);
        this.setCachedTimeOffRequests(organizationId, filteredRequests);
      }

      // Remove from user cache
      if (userId) {
        const userRequests = this.getCachedUserTimeOffRequests(userId);
        if (userRequests) {
          const filteredUserRequests = userRequests.filter(req => req.id !== requestId);
          this.setCachedUserTimeOffRequests(userId, filteredUserRequests);
        }
      }

      // Remove from pending approvals cache
      if (approverId) {
        const pendingApprovals = this.getCachedPendingApprovals(approverId);
        if (pendingApprovals) {
          const filteredApprovals = pendingApprovals.filter(req => req.id !== requestId);
          this.setCachedPendingApprovals(approverId, filteredApprovals);
        }
      }
    } catch (error) {
      console.warn('Failed to remove cached time off request:', error);
    }
  }

  // Clear specific caches
  clearTimeOffRequestsCache(organizationId) {
    try {
      localStorage.removeItem(this.getTimeOffRequestsKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear time off requests cache:', error);
    }
  }

  clearUserTimeOffRequestsCache(userId) {
    try {
      localStorage.removeItem(this.getUserTimeOffRequestsKey(userId));
    } catch (error) {
      console.warn('Failed to clear user time off requests cache:', error);
    }
  }

  clearPendingApprovalsCache(approverId) {
    try {
      localStorage.removeItem(this.getPendingApprovalsKey(approverId));
    } catch (error) {
      console.warn('Failed to clear pending approvals cache:', error);
    }
  }

  clearTimeOffBalancesCache(userId) {
    try {
      localStorage.removeItem(this.getTimeOffBalancesKey(userId));
    } catch (error) {
      console.warn('Failed to clear time off balances cache:', error);
    }
  }

  // Serialize time off request for storage
  serializeTimeOffRequest(request) {
    try {
      const serialized = { ...request };
      
      // Convert Timestamp fields
      const timestampFields = ['startDate', 'endDate', 'createdAt', 'updatedAt', 
                               'approvedAt', 'deniedAt', 'cancelledAt'];
      timestampFields.forEach(field => {
        if (serialized[field] && serialized[field].toMillis) {
          serialized[field] = {
            _isTimestamp: true,
            seconds: serialized[field].seconds,
            nanoseconds: serialized[field].nanoseconds
          };
        }
      });

      // Handle dates array if present
      if (serialized.dates && Array.isArray(serialized.dates)) {
        serialized.dates = serialized.dates.map(date => {
          if (date && date.toMillis) {
            return {
              _isTimestamp: true,
              seconds: date.seconds,
              nanoseconds: date.nanoseconds
            };
          }
          return date;
        });
      }

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize time off request:', error);
      return request;
    }
  }

  // Deserialize time off request from storage
  deserializeTimeOffRequest(request) {
    try {
      const deserialized = { ...request };
      
      // Restore Timestamp fields
      const timestampFields = ['startDate', 'endDate', 'createdAt', 'updatedAt', 
                               'approvedAt', 'deniedAt', 'cancelledAt'];
      timestampFields.forEach(field => {
        if (deserialized[field]?._isTimestamp) {
          deserialized[field] = new Timestamp(
            deserialized[field].seconds,
            deserialized[field].nanoseconds
          );
        }
      });

      // Handle dates array if present
      if (deserialized.dates && Array.isArray(deserialized.dates)) {
        deserialized.dates = deserialized.dates.map(date => {
          if (date?._isTimestamp) {
            return new Timestamp(
              date.seconds,
              date.nanoseconds
            );
          }
          return date;
        });
      }

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize time off request:', error);
      return request;
    }
  }

  // Get cache statistics
  getCacheStats() {
    try {
      let requestCount = 0;
      let approvalCount = 0;
      let balanceCount = 0;
      let totalSize = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            if (key.includes('requests_')) requestCount++;
            if (key.includes('pending_approvals_')) approvalCount++;
            if (key.includes('balances_')) balanceCount++;
          }
        }
      }
      
      return {
        requestCacheCount: requestCount,
        approvalCacheCount: approvalCount,
        balanceCacheCount: balanceCount,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        requestCacheCount: 0,
        approvalCacheCount: 0,
        balanceCacheCount: 0,
        totalSize: 0,
        totalSizeMB: 0
      };
    }
  }

  // Clear all time off caches
  clearAllTimeOffCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} time off cache items`);
    } catch (error) {
      console.warn('Failed to clear all time off caches:', error);
    }
  }
}

// Create singleton instance
export const timeOffCacheService = new TimeOffCacheService();
export default timeOffCacheService;