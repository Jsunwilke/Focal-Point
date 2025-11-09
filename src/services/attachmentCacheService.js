// src/services/attachmentCacheService.js

class AttachmentCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_attachments_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Get cache key for a task's attachments
   * @param {string} taskId - The task ID
   * @returns {string} - Cache key
   */
  getCacheKey(taskId) {
    return `${this.CACHE_PREFIX}${this.CACHE_VERSION}_${taskId}`;
  }

  /**
   * Get cached attachments for a task
   * @param {string} taskId - The task ID
   * @returns {Array|null} - Cached attachments or null
   */
  getCachedAttachments(taskId) {
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
      const attachments = parsed.attachments.map(attachment => ({
        ...attachment,
        uploadedAt: attachment.uploadedAt ? this.deserializeTimestamp(attachment.uploadedAt) : null
      }));

      return attachments;
    } catch (error) {
      console.error('Error reading attachments cache:', error);
      return null;
    }
  }

  /**
   * Set cached attachments for a task
   * @param {string} taskId - The task ID
   * @param {Array} attachments - Attachments to cache
   */
  setCachedAttachments(taskId, attachments) {
    const cacheKey = this.getCacheKey(taskId);

    // Serialize Firestore Timestamps for localStorage
    const serializedAttachments = attachments.map(attachment => ({
      ...attachment,
      uploadedAt: attachment.uploadedAt ? this.serializeTimestamp(attachment.uploadedAt) : null
    }));

    try {
      const cacheData = {
        attachments: serializedAttachments,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting attachments cache:', error);
      // If localStorage is full, clear old cache entries
      if (error.name === 'QuotaExceededError') {
        this.clearOldCache();
        // Try again after clearing
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            attachments: serializedAttachments,
            timestamp: Date.now(),
            version: this.CACHE_VERSION
          }));
        } catch (retryError) {
          console.error('Failed to cache attachments after cleanup:', retryError);
        }
      }
    }
  }

  /**
   * Add a new attachment to cache
   * @param {string} taskId - The task ID
   * @param {object} newAttachment - New attachment to add
   * @returns {Array} - Updated attachments array
   */
  addAttachment(taskId, newAttachment) {
    try {
      const cachedAttachments = this.getCachedAttachments(taskId) || [];

      // Add new attachment at the beginning (newest first)
      const updatedAttachments = [newAttachment, ...cachedAttachments];

      // Update cache
      this.setCachedAttachments(taskId, updatedAttachments);

      return updatedAttachments;
    } catch (error) {
      console.error('Error adding attachment to cache:', error);
      return [newAttachment];
    }
  }

  /**
   * Remove an attachment from cache
   * @param {string} taskId - The task ID
   * @param {string} attachmentId - Attachment ID to remove
   * @returns {Array} - Updated attachments array
   */
  removeAttachment(taskId, attachmentId) {
    try {
      const cachedAttachments = this.getCachedAttachments(taskId) || [];

      // Filter out the deleted attachment
      const updatedAttachments = cachedAttachments.filter(
        attachment => attachment.id !== attachmentId
      );

      // Update cache
      this.setCachedAttachments(taskId, updatedAttachments);

      return updatedAttachments;
    } catch (error) {
      console.error('Error removing attachment from cache:', error);
      return cachedAttachments;
    }
  }

  /**
   * Append new attachments to cache (merge with existing)
   * @param {string} taskId - The task ID
   * @param {Array} newAttachments - New attachments to add
   * @returns {Array} - Updated attachments array
   */
  appendNewAttachments(taskId, newAttachments) {
    try {
      const cachedAttachments = this.getCachedAttachments(taskId) || [];

      // Merge and remove duplicates (by id)
      const attachmentMap = new Map();

      // Add cached attachments first
      cachedAttachments.forEach(attachment => {
        attachmentMap.set(attachment.id, attachment);
      });

      // Add new attachments (will overwrite if duplicate id)
      newAttachments.forEach(attachment => {
        attachmentMap.set(attachment.id, attachment);
      });

      // Convert back to array and sort by uploadedAt (newest first)
      const mergedAttachments = Array.from(attachmentMap.values())
        .sort((a, b) => {
          const aTime = a.uploadedAt?.toMillis?.() || 0;
          const bTime = b.uploadedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      // Update cache
      this.setCachedAttachments(taskId, mergedAttachments);

      return mergedAttachments;
    } catch (error) {
      console.error('Error appending attachments to cache:', error);
      return newAttachments;
    }
  }

  /**
   * Get the latest attachment timestamp from cache
   * @param {string} taskId - The task ID
   * @returns {Timestamp|null} - Latest timestamp or null
   */
  getLatestTimestamp(taskId) {
    try {
      const cachedAttachments = this.getCachedAttachments(taskId);

      if (!cachedAttachments || cachedAttachments.length === 0) {
        return null;
      }

      // Attachments are sorted newest first, so first item is latest
      return cachedAttachments[0].uploadedAt;
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
      console.error('Error clearing attachments cache:', error);
    }
  }

  /**
   * Clear all attachment cache
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
      console.error('Error clearing all attachments cache:', error);
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
export const attachmentCacheService = new AttachmentCacheService();
