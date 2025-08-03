// Orders Cache Service
// Implements cache-first loading pattern for Captura orders data

import { readCounter } from './readCounter';

class OrdersCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_orders_';
    this.CACHE_VERSION = '1.0';
    this.CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
    this.MAX_CACHED_ORDERS = 500; // Limit to prevent localStorage overflow
  }

  // Get cache key for orders list
  getOrdersCacheKey(accountId, filters = {}) {
    // Create a unique key based on account and filters
    const filterKey = Object.keys(filters)
      .sort()
      .map(key => `${key}:${filters[key]}`)
      .join('_');
    return `${this.CACHE_PREFIX}list_${accountId}_${filterKey || 'all'}`;
  }

  // Get cache key for individual order
  getOrderCacheKey(accountId, orderId) {
    return `${this.CACHE_PREFIX}order_${accountId}_${orderId}`;
  }

  // Get cache key for order statistics
  getStatsCacheKey(accountId, range) {
    return `${this.CACHE_PREFIX}stats_${accountId}_${range}`;
  }

  // Serialize data for storage
  serializeData(data) {
    try {
      return JSON.stringify(data, (key, value) => {
        // Skip circular references and functions
        if (typeof value === 'function') return undefined;
        if (key === 'fullApiResponse') return undefined; // Skip large nested responses
        if (key === 'rawData') return undefined; // Skip raw data to reduce size
        
        // Handle dates
        if (value instanceof Date) {
          return { _type: 'date', _value: value.toISOString() };
        }
        // Handle timestamp-like objects
        if (value && value.toDate && typeof value.toDate === 'function') {
          return { _type: 'timestamp', _value: value.toDate().toISOString() };
        }
        return value;
      });
    } catch (error) {
      console.error('Serialization error:', error);
      // Return a minimal version if full serialization fails
      return JSON.stringify({ error: 'Serialization failed', timestamp: new Date().toISOString() });
    }
  }

  // Deserialize data from storage
  deserializeData(json) {
    return JSON.parse(json, (key, value) => {
      if (value && value._type === 'date') {
        return new Date(value._value);
      }
      if (value && value._type === 'timestamp') {
        return { toDate: () => new Date(value._value) };
      }
      return value;
    });
  }

  // Get cached orders list
  getCachedOrders(accountId, filters = {}) {
    try {
      const cacheKey = this.getOrdersCacheKey(accountId, filters);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const cacheData = this.deserializeData(cached);

      // Check cache validity
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Record cache hit
      const orderCount = cacheData.data?.orders?.length || 0;
      readCounter.recordCacheHit('orders', 'OrdersCacheService', orderCount);

      return cacheData.data;
    } catch (error) {
      console.error('Error reading orders cache:', error);
      return null;
    }
  }

  // Set cached orders list
  setCachedOrders(accountId, filters, data) {
    try {
      const cacheKey = this.getOrdersCacheKey(accountId, filters);
      
      // Limit the number of cached orders
      if (data.orders && data.orders.length > this.MAX_CACHED_ORDERS) {
        data = {
          ...data,
          orders: data.orders.slice(0, this.MAX_CACHED_ORDERS)
        };
      }

      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data
      };

      localStorage.setItem(cacheKey, this.serializeData(cacheData));
    } catch (error) {
      console.error('Error setting orders cache:', error);
      // Clear cache if storage is full
      if (error.name === 'QuotaExceededError') {
        this.clearOldCache();
      }
    }
  }

  // Get cached individual order
  getCachedOrder(accountId, orderId) {
    try {
      const cacheKey = this.getOrderCacheKey(accountId, orderId);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const cacheData = this.deserializeData(cached);

      // Check cache validity
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      readCounter.recordCacheHit('orders', 'OrdersCacheService', 1);
      return cacheData.data;
    } catch (error) {
      console.error('Error reading order cache:', error);
      return null;
    }
  }

  // Set cached individual order
  setCachedOrder(accountId, orderId, order) {
    try {
      const cacheKey = this.getOrderCacheKey(accountId, orderId);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: order
      };

      localStorage.setItem(cacheKey, this.serializeData(cacheData));
    } catch (error) {
      console.error('Error setting order cache:', error);
    }
  }

  // Get cached statistics
  getCachedStatistics(accountId, range) {
    try {
      const cacheKey = this.getStatsCacheKey(accountId, range);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const cacheData = this.deserializeData(cached);

      // Statistics cache is valid for shorter duration (1 hour)
      const statsCacheDuration = 60 * 60 * 1000;
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > statsCacheDuration) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      readCounter.recordCacheHit('orders-stats', 'OrdersCacheService', 1);
      return cacheData.data;
    } catch (error) {
      console.error('Error reading statistics cache:', error);
      return null;
    }
  }

  // Set cached statistics
  setCachedStatistics(accountId, range, stats) {
    try {
      const cacheKey = this.getStatsCacheKey(accountId, range);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: stats
      };

      localStorage.setItem(cacheKey, this.serializeData(cacheData));
    } catch (error) {
      console.error('Error setting statistics cache:', error);
    }
  }

  // Update a single order in the cached list
  updateCachedOrder(accountId, filters, updatedOrder) {
    try {
      const cacheKey = this.getOrdersCacheKey(accountId, filters);
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return;

      const cacheData = this.deserializeData(cached);
      
      if (cacheData.data && cacheData.data.orders) {
        const orderIndex = cacheData.data.orders.findIndex(o => o.id === updatedOrder.id);
        if (orderIndex !== -1) {
          cacheData.data.orders[orderIndex] = updatedOrder;
          localStorage.setItem(cacheKey, this.serializeData(cacheData));
        }
      }
    } catch (error) {
      console.error('Error updating cached order:', error);
    }
  }

  // Clear all orders cache
  clearCache(accountId = null) {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          if (!accountId || key.includes(`_${accountId}_`)) {
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Error clearing orders cache:', error);
    }
  }

  // Clear old cache entries
  clearOldCache() {
    try {
      const keys = Object.keys(localStorage);
      const cacheEntries = [];

      // Collect all cache entries with timestamps
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            const cacheData = this.deserializeData(cached);
            cacheEntries.push({ key, timestamp: cacheData.timestamp || 0 });
          } catch (e) {
            // Remove corrupted entries
            localStorage.removeItem(key);
          }
        }
      });

      // Sort by timestamp and remove oldest entries
      cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
      const entriesToRemove = Math.floor(cacheEntries.length / 3); // Remove oldest third
      
      for (let i = 0; i < entriesToRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key);
      }
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    let totalEntries = 0;
    let totalSize = 0;
    let oldestEntry = Date.now();

    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.CACHE_PREFIX)) {
        totalEntries++;
        const value = localStorage.getItem(key);
        totalSize += (key.length + value.length) * 2; // Rough estimate in bytes

        try {
          const cacheData = this.deserializeData(value);
          if (cacheData.timestamp && cacheData.timestamp < oldestEntry) {
            oldestEntry = cacheData.timestamp;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    return {
      totalEntries,
      totalSizeKB: Math.round(totalSize / 1024),
      oldestEntryAge: oldestEntry < Date.now() ? Math.round((Date.now() - oldestEntry) / 1000 / 60) : 0
    };
  }
}

// Export singleton instance
export const ordersCacheService = new OrdersCacheService();