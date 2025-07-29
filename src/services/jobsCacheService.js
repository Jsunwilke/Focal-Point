import { Timestamp } from 'firebase/firestore';

class JobsCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_jobs_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
    this.SHORT_CACHE_AGE = 5 * 60 * 1000; // 5 minutes for active data
  }

  // Jobs cache key
  getJobsKey(organizationId) {
    return `${this.CACHE_PREFIX}org_${organizationId}`;
  }

  // Single job cache key
  getSingleJobKey(jobId) {
    return `${this.CACHE_PREFIX}job_${jobId}`;
  }

  // Cache all jobs for an organization
  setCachedJobs(organizationId, jobs) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: jobs.map(job => this.serializeJob(job))
      };
      localStorage.setItem(this.getJobsKey(organizationId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache jobs:', error);
    }
  }

  // Get cached jobs
  getCachedJobs(organizationId) {
    try {
      const key = this.getJobsKey(organizationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearJobsCache(organizationId);
        return null;
      }

      // Deserialize jobs
      const jobs = cacheData.data.map(job => this.deserializeJob(job));
      return jobs;
    } catch (error) {
      console.warn('Failed to retrieve cached jobs:', error);
      return null;
    }
  }

  // Cache single job
  setCachedJob(jobId, job) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: this.serializeJob(job)
      };
      localStorage.setItem(this.getSingleJobKey(jobId), JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache job ${jobId}:`, error);
    }
  }

  // Get cached single job
  getCachedJob(jobId) {
    try {
      const key = this.getSingleJobKey(jobId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age (shorter for single jobs)
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.SHORT_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      return this.deserializeJob(cacheData.data);
    } catch (error) {
      console.warn(`Failed to retrieve cached job ${jobId}:`, error);
      return null;
    }
  }

  // Update single job in jobs cache
  updateCachedJob(organizationId, updatedJob) {
    try {
      const cachedJobs = this.getCachedJobs(organizationId);
      if (!cachedJobs) return;

      const index = cachedJobs.findIndex(job => job.id === updatedJob.id);
      if (index !== -1) {
        cachedJobs[index] = updatedJob;
        this.setCachedJobs(organizationId, cachedJobs);
      }
    } catch (error) {
      console.warn('Failed to update cached job:', error);
    }
  }

  // Remove job from cache
  removeCachedJob(organizationId, jobId) {
    try {
      const cachedJobs = this.getCachedJobs(organizationId);
      if (!cachedJobs) return;

      const filteredJobs = cachedJobs.filter(job => job.id !== jobId);
      this.setCachedJobs(organizationId, filteredJobs);
      
      // Also remove single job cache
      localStorage.removeItem(this.getSingleJobKey(jobId));
    } catch (error) {
      console.warn('Failed to remove cached job:', error);
    }
  }

  // Get latest job timestamp for incremental updates
  getLatestJobTimestamp(organizationId) {
    try {
      const jobs = this.getCachedJobs(organizationId);
      if (!jobs || jobs.length === 0) return null;

      // Find the latest updated timestamp
      const latestJob = jobs.reduce((latest, current) => {
        const currentTime = current.updatedAt?.toMillis?.() || current.createdAt?.toMillis?.() || 0;
        const latestTime = latest.updatedAt?.toMillis?.() || latest.createdAt?.toMillis?.() || 0;
        return currentTime > latestTime ? current : latest;
      });

      return latestJob.updatedAt || latestJob.createdAt;
    } catch (error) {
      console.warn('Failed to get latest job timestamp:', error);
      return null;
    }
  }

  // Clear jobs cache
  clearJobsCache(organizationId) {
    try {
      localStorage.removeItem(this.getJobsKey(organizationId));
    } catch (error) {
      console.warn('Failed to clear jobs cache:', error);
    }
  }

  // Serialize job for storage
  serializeJob(job) {
    try {
      const serialized = { ...job };
      
      // Convert Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'shootDate'];
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
      console.warn('Failed to serialize job:', error);
      return job;
    }
  }

  // Deserialize job from storage
  deserializeJob(job) {
    try {
      const deserialized = { ...job };
      
      // Restore Timestamp fields
      const timestampFields = ['createdAt', 'updatedAt', 'shootDate'];
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
      console.warn('Failed to deserialize job:', error);
      return job;
    }
  }

  // Get cache statistics
  getCacheStats(organizationId) {
    try {
      const jobs = this.getCachedJobs(organizationId);
      const key = this.getJobsKey(organizationId);
      const cached = localStorage.getItem(key);
      
      return {
        hasCachedJobs: !!jobs,
        jobCount: jobs ? jobs.length : 0,
        cacheSize: cached ? cached.length : 0,
        cacheAge: cached ? Date.now() - JSON.parse(cached).timestamp : null
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        hasCachedJobs: false,
        jobCount: 0,
        cacheSize: 0,
        cacheAge: null
      };
    }
  }

  // Clear all job caches
  clearAllJobCaches() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} job cache items`);
    } catch (error) {
      console.warn('Failed to clear all job caches:', error);
    }
  }
}

// Create singleton instance
export const jobsCacheService = new JobsCacheService();
export default jobsCacheService;