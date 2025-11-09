// src/services/activityCacheService.js

class ActivityCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_activities_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Get cache key for a task's activities
   * @param {string} taskId - The task ID
   * @returns {string} - Cache key
   */
  getCacheKey(taskId) {
    return `${this.CACHE_PREFIX}${this.CACHE_VERSION}_${taskId}`;
  }

  /**
   * Get cached activities for a task
   * @param {string} taskId - The task ID
   * @returns {Array|null} - Cached activities or null
   */
  getCachedActivities(taskId) {
    try {
      const cacheKey = this.getCacheKey(taskId);
      const cachedData = localStorage.getItem(cacheKey);

      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);

      // Check if cache is expired
      if (Date.now() - parsed.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Restore Firestore Timestamps
      const activities = parsed.activities.map(activity => ({
        ...activity,
        timestamp: activity.timestamp ? this.deserializeTimestamp(activity.timestamp) : null
      }));

      return activities;
    } catch (error) {
      console.error('Error reading activities cache:', error);
      return null;
    }
  }

  /**
   * Set cached activities for a task
   * @param {string} taskId - The task ID
   * @param {Array} activities - Activities to cache
   */
  setCachedActivities(taskId, activities) {
    const cacheKey = this.getCacheKey(taskId);

    // Serialize Firestore Timestamps for localStorage
    const serializedActivities = activities.map(activity => ({
      ...activity,
      timestamp: activity.timestamp ? this.serializeTimestamp(activity.timestamp) : null
    }));

    try {
      const cacheData = {
        activities: serializedActivities,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting activities cache:', error);
      // If localStorage is full, clear old cache entries
      if (error.name === 'QuotaExceededError') {
        this.clearOldCache();
        // Try again after clearing
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            activities: serializedActivities,
            timestamp: Date.now(),
            version: this.CACHE_VERSION
          }));
        } catch (retryError) {
          console.error('Failed to cache activities after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Append new activities to cache
   * @param {string} taskId - The task ID
   * @param {Array} newActivities - New activities to add
   * @returns {Array} - Updated activities array
   */
  appendNewActivities(taskId, newActivities) {
    try {
      const cachedActivities = this.getCachedActivities(taskId) || [];

      // Merge and remove duplicates (by id)
      const activityMap = new Map();

      // Add cached activities first
      cachedActivities.forEach(activity => {
        activityMap.set(activity.id, activity);
      });

      // Add new activities (will overwrite if duplicate id)
      newActivities.forEach(activity => {
        activityMap.set(activity.id, activity);
      });

      // Convert back to array and sort by timestamp (newest first)
      const mergedActivities = Array.from(activityMap.values())
        .sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() || 0;
          const bTime = b.timestamp?.toMillis?.() || 0;
          return bTime - aTime;
        });

      // Update cache
      this.setCachedActivities(taskId, mergedActivities);

      return mergedActivities;
    } catch (error) {
      console.error('Error appending activities to cache:', error);
      return newActivities;
    }
  }

  /**
   * Get the latest activity timestamp from cache
   * @param {string} taskId - The task ID
   * @returns {Timestamp|null} - Latest timestamp or null
   */
  getLatestTimestamp(taskId) {
    try {
      const cachedActivities = this.getCachedActivities(taskId);

      if (!cachedActivities || cachedActivities.length === 0) {
        return null;
      }

      // Activities are sorted newest first, so first item is latest
      return cachedActivities[0].timestamp;
    } catch (error) {
      console.error('Error getting latest timestamp:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific task
   * @param {string} taskId - The task ID
   */
  clearCache(taskId) {
    try {
      const cacheKey = this.getCacheKey(taskId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error clearing activities cache:', error);
    }
  }

  /**
   * Clear all activity cache
   */
  clearAllCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing all activities cache:', error);
    }
  }

  /**
   * Clear old cache entries (older than MAX_CACHE_AGE)
   */
  clearOldCache() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && (now - data.timestamp > this.MAX_CACHE_AGE)) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // If can't parse, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  /**
   * Serialize Firestore Timestamp for localStorage
   * @param {Timestamp} timestamp - Firestore Timestamp
   * @returns {object} - Serialized timestamp
   */
  serializeTimestamp(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toMillis) {
      return {
        _seconds: timestamp.seconds,
        _nanoseconds: timestamp.nanoseconds
      };
    }
    return timestamp;
  }

  /**
   * Deserialize timestamp from localStorage
   * @param {object} serialized - Serialized timestamp
   * @returns {object} - Timestamp-like object with toMillis method
   */
  deserializeTimestamp(serialized) {
    if (!serialized) return null;
    if (serialized._seconds !== undefined) {
      return {
        seconds: serialized._seconds,
        nanoseconds: serialized._nanoseconds,
        toMillis: function() {
          return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
        },
        toDate: function() {
          return new Date(this.toMillis());
        }
      };
    }
    return serialized;
  }
}

// Export singleton instance
export const activityCacheService = new ActivityCacheService();
