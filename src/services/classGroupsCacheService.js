import { Timestamp } from 'firebase/firestore';

class ClassGroupsCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_classGroups_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
    this.SHORT_CACHE_AGE = 5 * 60 * 1000; // 5 minutes for active data
  }

  // Class groups cache key
  getClassGroupsKey(organizationId) {
    return `${this.CACHE_PREFIX}org_${organizationId}`;
  }

  // Single class group job cache key
  getSingleClassGroupKey(jobId) {
    return `${this.CACHE_PREFIX}job_${jobId}`;
  }

  // Cache all class group jobs for an organization
  setCachedClassGroups(organizationId, classGroupJobs) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: classGroupJobs.map(job => this.serializeClassGroupJob(job))
      };
      localStorage.setItem(this.getClassGroupsKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache class groups:', error);
    }
  }

  // Get cached class group jobs
  getCachedClassGroups(organizationId) {
    try {
      const key = this.getClassGroupsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearClassGroupsCache(organizationId);
        return null;
      }

      // Deserialize class group jobs
      const classGroupJobs = cacheData.data.map(job => this.deserializeClassGroupJob(job));
      return classGroupJobs;
    } catch (error) {
      console.warn('Failed to retrieve cached class groups:', error);
      return null;
    }
  }

  // Cache single class group job
  setCachedClassGroupJob(jobId, job) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: this.serializeClassGroupJob(job)
      };
      localStorage.setItem(this.getSingleClassGroupKey(jobId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache class group job ${jobId}:`, error);
    }
  }

  // Get cached single class group job
  getCachedClassGroupJob(jobId) {
    try {
      const key = this.getSingleClassGroupKey(jobId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age (shorter for single jobs)
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.SHORT_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return this.deserializeClassGroupJob(cacheData.data);
    } catch (error) {
      console.warn(`Failed to retrieve cached class group job ${jobId}:`, error);
      return null;
    }
  }

  // Update single class group job in cache
  updateCachedClassGroupJob(organizationId, updatedJob) {
    try {
      const cachedJobs = this.getCachedClassGroups(organizationId);
      if (cachedJobs) {
        const index = cachedJobs.findIndex(job => job.id === updatedJob.id);
        if (index !== -1) {
          cachedJobs[index] = updatedJob;
          this.setCachedClassGroups(organizationId, cachedJobs);
        }
      }
      // Also update single job cache
      this.setCachedClassGroupJob(updatedJob.id, updatedJob);
    } catch (error) {
      console.warn('Failed to update cached class group job:', error);
    }
  }

  // Remove class group job from cache
  removeCachedClassGroupJob(organizationId, jobId) {
    try {
      const cachedJobs = this.getCachedClassGroups(organizationId);
      if (cachedJobs) {
        const filtered = cachedJobs.filter(job => job.id !== jobId);
        this.setCachedClassGroups(organizationId, filtered);
      }
      // Also remove single job cache
      localStorage.removeItem(this.getSingleClassGroupKey(jobId));
    } catch (error) {
      console.warn('Failed to remove cached class group job:', error);
    }
  }

  // Serialize class group job for storage
  serializeClassGroupJob(job) {
    const serialized = { ...job };
    
    // Convert Timestamps to plain objects
    if (job.createdAt instanceof Timestamp) {
      serialized.createdAt = {
        seconds: job.createdAt.seconds,
        nanoseconds: job.createdAt.nanoseconds
      };
    }
    if (job.updatedAt instanceof Timestamp) {
      serialized.updatedAt = {
        seconds: job.updatedAt.seconds,
        nanoseconds: job.updatedAt.nanoseconds
      };
    }
    if (job.sessionDate instanceof Timestamp) {
      serialized.sessionDate = {
        seconds: job.sessionDate.seconds,
        nanoseconds: job.sessionDate.nanoseconds
      };
    }

    // Ensure classGroups array is properly serialized
    if (job.classGroups && Array.isArray(job.classGroups)) {
      serialized.classGroups = job.classGroups.map(group => ({ ...group }));
    }

    return serialized;
  }

  // Deserialize class group job from storage
  deserializeClassGroupJob(data) {
    const job = { ...data };
    
    // Convert plain objects back to Timestamps
    if (data.createdAt && typeof data.createdAt === 'object') {
      job.createdAt = new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds);
    }
    if (data.updatedAt && typeof data.updatedAt === 'object') {
      job.updatedAt = new Timestamp(data.updatedAt.seconds, data.updatedAt.nanoseconds);
    }
    if (data.sessionDate && typeof data.sessionDate === 'object') {
      job.sessionDate = new Timestamp(data.sessionDate.seconds, data.sessionDate.nanoseconds);
    }

    return job;
  }

  // Get latest timestamp for incremental updates
  getLatestTimestamp(organizationId) {
    try {
      const cachedJobs = this.getCachedClassGroups(organizationId);
      if (!cachedJobs || cachedJobs.length === 0) return null;

      let latestTimestamp = null;
      cachedJobs.forEach(job => {
        if (job.updatedAt && (!latestTimestamp || job.updatedAt.seconds > latestTimestamp.seconds)) {
          latestTimestamp = job.updatedAt;
        }
      });

      return latestTimestamp;
    } catch (error) {
      console.warn('Failed to get latest timestamp:', error);
      return null;
    }
  }

  // Clear cache for organization
  clearClassGroupsCache(organizationId) {
    try {
      localStorage.removeItem(this.getClassGroupsKey(organizationId));
      // Also clear individual job caches
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.CACHE_PREFIX}job_`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear class groups cache:', error);
    }
  }

  // Clear all class groups caches
  clearAllCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear all class groups caches:', error);
    }
  }

  // Get cache size info
  getCacheInfo(organizationId) {
    try {
      const key = this.getClassGroupsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const sizeInBytes = new Blob([cached]).size;
      
      return {
        version: cacheData.version,
        timestamp: cacheData.timestamp,
        age: Date.now() - cacheData.timestamp,
        itemCount: cacheData.data?.length || 0,
        sizeInBytes,
        sizeInKB: (sizeInBytes / 1024).toFixed(2)
      };
    } catch (error) {
      console.warn('Failed to get cache info:', error);
      return null;
    }
  }
}

const classGroupsCacheService = new ClassGroupsCacheService();
export default classGroupsCacheService;