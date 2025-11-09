import { Timestamp } from 'firebase/firestore';

class TaskCommentsCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_task_comments_';
    this.CACHE_VERSION = '1.0';
    this.CACHE_AGE = 12 * 60 * 60 * 1000; // 12 hours
  }

  // Comments cache key for a specific task
  getCommentsKey(taskId) {
    return `${this.CACHE_PREFIX}${taskId}`;
  }

  // Cache task comments
  setCachedComments(taskId, comments) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: comments.map(comment => this.serializeComment(comment))
      };
      const key = this.getCommentsKey(taskId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache comments for task ${taskId}:`, error);
    }
  }

  // Get cached task comments
  getCachedComments(taskId) {
    try {
      const key = this.getCommentsKey(taskId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);

      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION ||
          Date.now() - cacheData.timestamp > this.CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize comments
      return cacheData.data.map(comment => this.deserializeComment(comment));
    } catch (error) {
      console.warn(`Failed to retrieve cached comments for task ${taskId}:`, error);
      return null;
    }
  }

  // Add new comment to cache
  addCommentToCache(taskId, newComment) {
    try {
      const comments = this.getCachedComments(taskId) || [];
      comments.push(newComment);
      // Sort by timestamp (newest first)
      comments.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });
      this.setCachedComments(taskId, comments);
    } catch (error) {
      console.warn('Failed to add comment to cache:', error);
    }
  }

  // Update comment in cache
  updateCommentInCache(taskId, commentId, updates) {
    try {
      const comments = this.getCachedComments(taskId);
      if (!comments) return;

      const index = comments.findIndex(c => c.id === commentId);
      if (index !== -1) {
        comments[index] = { ...comments[index], ...updates };
        this.setCachedComments(taskId, comments);
      }
    } catch (error) {
      console.warn('Failed to update comment in cache:', error);
    }
  }

  // Remove comment from cache
  removeCommentFromCache(taskId, commentId) {
    try {
      const comments = this.getCachedComments(taskId);
      if (!comments) return;

      const filteredComments = comments.filter(c => c.id !== commentId);
      this.setCachedComments(taskId, filteredComments);
    } catch (error) {
      console.warn('Failed to remove comment from cache:', error);
    }
  }

  // Get latest comment timestamp (for optimized listeners)
  getLatestCommentTimestamp(taskId) {
    try {
      const comments = this.getCachedComments(taskId);
      if (!comments || comments.length === 0) return null;

      let latestTimestamp = null;
      comments.forEach(comment => {
        const commentTimestamp = comment.createdAt;
        if (commentTimestamp && commentTimestamp.toMillis) {
          if (!latestTimestamp || commentTimestamp.toMillis() > latestTimestamp.toMillis()) {
            latestTimestamp = commentTimestamp;
          }
        }
      });

      return latestTimestamp;
    } catch (error) {
      console.warn('Failed to get latest comment timestamp:', error);
      return null;
    }
  }

  // Clear comments cache for a task
  clearTaskComments(taskId) {
    try {
      const key = this.getCommentsKey(taskId);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear comments cache for task ${taskId}:`, error);
    }
  }

  // Clear all comments caches
  clearAllCommentsCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} comment cache items`);
    } catch (error) {
      console.warn('Failed to clear all comments caches:', error);
    }
  }

  // Serialize comment for storage
  serializeComment(comment) {
    try {
      const serialized = { ...comment };

      // Convert Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt'];
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
      console.warn('Failed to serialize comment:', error);
      return comment;
    }
  }

  // Deserialize comment from storage
  deserializeComment(comment) {
    try {
      const deserialized = { ...comment };

      // Restore Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt'];
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
      console.warn('Failed to deserialize comment:', error);
      return comment;
    }
  }

  // Get cache statistics
  getCacheStats() {
    try {
      let commentCacheCount = 0;
      let totalSize = 0;
      let totalComments = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            commentCacheCount++;
            try {
              const cacheData = JSON.parse(value);
              if (cacheData.data && Array.isArray(cacheData.data)) {
                totalComments += cacheData.data.length;
              }
            } catch (e) {
              // Skip invalid cache entries
            }
          }
        }
      }

      return {
        commentCacheCount,
        totalComments,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        commentCacheCount: 0,
        totalComments: 0,
        totalSize: 0,
        totalSizeMB: 0
      };
    }
  }
}

// Create singleton instance
export const taskCommentsCacheService = new TaskCommentsCacheService();
export default taskCommentsCacheService;
