import { Timestamp } from 'firebase/firestore';

class TaskCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_task_';
    this.CACHE_VERSION = '1.0';
    this.TASK_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Tasks cache key
  getTasksKey(userId, organizationId, filter = 'all') {
    return `${this.CACHE_PREFIX}tasks_${organizationId}_${userId}_${filter}`;
  }

  // Team tasks cache key (for managers/admins)
  getTeamTasksKey(organizationId) {
    return `${this.CACHE_PREFIX}team_tasks_${organizationId}`;
  }

  // Single task cache key
  getTaskKey(taskId) {
    return `${this.CACHE_PREFIX}task_${taskId}`;
  }

  // Cache user tasks
  setCachedTasks(userId, organizationId, filter, tasks) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: tasks.map(task => this.serializeTask(task))
      };
      const key = this.getTasksKey(userId, organizationId, filter);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache tasks:', error);
    }
  }

  // Get cached user tasks
  getCachedTasks(userId, organizationId, filter) {
    try {
      const key = this.getTasksKey(userId, organizationId, filter);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);

      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION ||
          Date.now() - cacheData.timestamp > this.TASK_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize tasks
      return cacheData.data.map(task => this.deserializeTask(task));
    } catch (error) {
      console.warn('Failed to retrieve cached tasks:', error);
      return null;
    }
  }

  // Cache team tasks
  setCachedTeamTasks(organizationId, tasks) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: tasks.map(task => this.serializeTask(task))
      };
      const key = this.getTeamTasksKey(organizationId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache team tasks:', error);
    }
  }

  // Get cached team tasks
  getCachedTeamTasks(organizationId) {
    try {
      const key = this.getTeamTasksKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);

      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION ||
          Date.now() - cacheData.timestamp > this.TASK_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      // Deserialize tasks
      return cacheData.data.map(task => this.deserializeTask(task));
    } catch (error) {
      console.warn('Failed to retrieve cached team tasks:', error);
      return null;
    }
  }

  // Cache single task
  setCachedTask(taskId, task) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: this.serializeTask(task)
      };
      const key = this.getTaskKey(taskId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache task ${taskId}:`, error);
    }
  }

  // Get cached single task
  getCachedTask(taskId) {
    try {
      const key = this.getTaskKey(taskId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);

      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION ||
          Date.now() - cacheData.timestamp > this.TASK_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return this.deserializeTask(cacheData.data);
    } catch (error) {
      console.warn(`Failed to retrieve cached task ${taskId}:`, error);
      return null;
    }
  }

  // Update single task in cache
  updateCachedTask(userId, organizationId, filter, updatedTask) {
    try {
      const tasks = this.getCachedTasks(userId, organizationId, filter);
      if (!tasks) return;

      const index = tasks.findIndex(task => task.id === updatedTask.id);
      if (index !== -1) {
        tasks[index] = updatedTask;
        this.setCachedTasks(userId, organizationId, filter, tasks);
      }

      // Also update single task cache
      this.setCachedTask(updatedTask.id, updatedTask);
    } catch (error) {
      console.warn('Failed to update cached task:', error);
    }
  }

  // Remove task from cache
  removeCachedTask(userId, organizationId, filter, taskId) {
    try {
      const tasks = this.getCachedTasks(userId, organizationId, filter);
      if (!tasks) return;

      const filteredTasks = tasks.filter(task => task.id !== taskId);
      this.setCachedTasks(userId, organizationId, filter, filteredTasks);

      // Also remove single task cache
      const key = this.getTaskKey(taskId);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to remove cached task:', error);
    }
  }

  // Clear all task caches for an organization
  clearOrganizationCache(organizationId) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX) && key.includes(organizationId)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear organization cache:', error);
    }
  }

  // Clear all task caches
  clearAllTaskCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} task cache items`);
    } catch (error) {
      console.warn('Failed to clear all task caches:', error);
    }
  }

  // Serialize task for storage
  serializeTask(task) {
    try {
      const serialized = { ...task };

      // Convert Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'dueDate', 'startDate', 'completedAt'];
      timestampFields.forEach(field => {
        if (serialized[field] && serialized[field].toMillis) {
          serialized[field] = {
            _isTimestamp: true,
            seconds: serialized[field].seconds,
            nanoseconds: serialized[field].nanoseconds
          };
        }
      });

      // Handle subtasks timestamps
      if (serialized.subtasks && Array.isArray(serialized.subtasks)) {
        serialized.subtasks = serialized.subtasks.map(subtask => {
          const serializedSubtask = { ...subtask };
          if (serializedSubtask.completedAt && serializedSubtask.completedAt.toMillis) {
            serializedSubtask.completedAt = {
              _isTimestamp: true,
              seconds: serializedSubtask.completedAt.seconds,
              nanoseconds: serializedSubtask.completedAt.nanoseconds
            };
          }
          return serializedSubtask;
        });
      }

      return serialized;
    } catch (error) {
      console.warn('Failed to serialize task:', error);
      return task;
    }
  }

  // Deserialize task from storage
  deserializeTask(task) {
    try {
      const deserialized = { ...task };

      // Restore Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'dueDate', 'startDate', 'completedAt'];
      timestampFields.forEach(field => {
        if (deserialized[field]?._isTimestamp) {
          deserialized[field] = new Timestamp(
            deserialized[field].seconds,
            deserialized[field].nanoseconds
          );
        }
      });

      // Handle subtasks timestamps
      if (deserialized.subtasks && Array.isArray(deserialized.subtasks)) {
        deserialized.subtasks = deserialized.subtasks.map(subtask => {
          const deserializedSubtask = { ...subtask };
          if (deserializedSubtask.completedAt?._isTimestamp) {
            deserializedSubtask.completedAt = new Timestamp(
              deserializedSubtask.completedAt.seconds,
              deserializedSubtask.completedAt.nanoseconds
            );
          }
          return deserializedSubtask;
        });
      }

      return deserialized;
    } catch (error) {
      console.warn('Failed to deserialize task:', error);
      return task;
    }
  }

  // Get latest timestamp from cached tasks (for optimized listeners)
  getLatestTimestamp(userId, organizationId, filter) {
    try {
      const tasks = this.getCachedTasks(userId, organizationId, filter);
      if (!tasks || tasks.length === 0) return null;

      let latestTimestamp = null;
      tasks.forEach(task => {
        const taskTimestamp = task.updatedAt || task.createdAt;
        if (taskTimestamp && taskTimestamp.toMillis) {
          if (!latestTimestamp || taskTimestamp.toMillis() > latestTimestamp.toMillis()) {
            latestTimestamp = taskTimestamp;
          }
        }
      });

      return latestTimestamp;
    } catch (error) {
      console.warn('Failed to get latest timestamp:', error);
      return null;
    }
  }

  // Get cache statistics
  getCacheStats(organizationId) {
    try {
      let taskCount = 0;
      let totalSize = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += value.length;
            if (key.includes('tasks_')) taskCount++;
          }
        }
      }

      return {
        taskCount,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        taskCount: 0,
        totalSize: 0,
        totalSizeMB: 0
      };
    }
  }
}

// Create singleton instance
export const taskCacheService = new TaskCacheService();
export default taskCacheService;
