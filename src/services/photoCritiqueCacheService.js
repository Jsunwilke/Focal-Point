// src/services/photoCritiqueCacheService.js
import { Timestamp } from 'firebase/firestore';
import { readCounter } from './readCounter';

class PhotoCritiqueCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_critique_';
    this.CRITIQUES_KEY = `${this.CACHE_PREFIX}critiques`;
    this.FEEDBACK_PREFIX = `${this.CACHE_PREFIX}feedback_`;
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.MAX_CRITIQUES_CACHE = 100; // Limit number of cached critiques
    this.MAX_FEEDBACK_PER_CRITIQUE = 50; // Limit feedback cache size
  }

  // Critiques cache management
  setCachedCritiques(organizationId, critiques) {
    try {
      const key = `${this.CRITIQUES_KEY}_${organizationId}`;
      
      // Limit cache size
      const limitedCritiques = critiques.slice(0, this.MAX_CRITIQUES_CACHE);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        organizationId,
        data: limitedCritiques.map(critique => this.serializeCritique(critique))
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache critiques:', error);
      // Clear cache if storage is full
      if (error.name === 'QuotaExceededError') {
        this.clearOldCaches();
      }
    }
  }

  getCachedCritiques(organizationId) {
    try {
      const key = `${this.CRITIQUES_KEY}_${organizationId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearCritiquesCache(organizationId);
        return null;
      }

      // Deserialize critiques
      const critiques = cacheData.data.map(critique => this.deserializeCritique(critique));
      
      // Record cache hit
      readCounter.recordCacheHit('photoCritiques', 'PhotoCritiqueCacheService', critiques.length);
      
      return critiques;
    } catch (error) {
      console.warn('Failed to retrieve cached critiques:', error);
      readCounter.recordCacheMiss('photoCritiques', 'PhotoCritiqueCacheService');
      return null;
    }
  }

  clearCritiquesCache(organizationId) {
    try {
      const key = `${this.CRITIQUES_KEY}_${organizationId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear critiques cache:', error);
    }
  }

  // Individual critique cache
  setCachedCritique(critiqueId, critique) {
    try {
      const key = `${this.CACHE_PREFIX}critique_${critiqueId}`;
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: this.serializeCritique(critique)
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache critique ${critiqueId}:`, error);
    }
  }

  getCachedCritique(critiqueId) {
    try {
      const key = `${this.CACHE_PREFIX}critique_${critiqueId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        localStorage.removeItem(key);
        return null;
      }

      readCounter.recordCacheHit('photoCritiques', 'PhotoCritiqueCacheService', 1);
      return this.deserializeCritique(cacheData.data);
    } catch (error) {
      console.warn(`Failed to retrieve cached critique ${critiqueId}:`, error);
      readCounter.recordCacheMiss('photoCritiques', 'PhotoCritiqueCacheService');
      return null;
    }
  }

  // Feedback cache management
  setCachedFeedback(critiqueId, feedback) {
    try {
      const key = `${this.FEEDBACK_PREFIX}${critiqueId}`;
      
      // Limit cache size
      const limitedFeedback = feedback.slice(0, this.MAX_FEEDBACK_PER_CRITIQUE);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        critiqueId,
        data: limitedFeedback.map(fb => this.serializeFeedback(fb))
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache feedback for critique ${critiqueId}:`, error);
    }
  }

  getCachedFeedback(critiqueId) {
    try {
      const key = `${this.FEEDBACK_PREFIX}${critiqueId}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearFeedbackCache(critiqueId);
        return null;
      }

      // Deserialize feedback
      const feedback = cacheData.data.map(fb => this.deserializeFeedback(fb));
      
      // Record cache hit
      readCounter.recordCacheHit('critiqueFeedback', 'PhotoCritiqueCacheService', feedback.length);
      
      return feedback;
    } catch (error) {
      console.warn(`Failed to retrieve cached feedback for critique ${critiqueId}:`, error);
      readCounter.recordCacheMiss('critiqueFeedback', 'PhotoCritiqueCacheService');
      return null;
    }
  }

  clearFeedbackCache(critiqueId) {
    try {
      const key = `${this.FEEDBACK_PREFIX}${critiqueId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear feedback cache:', error);
    }
  }

  // Get latest timestamp for incremental updates
  getLatestCritiqueTimestamp(organizationId) {
    try {
      const critiques = this.getCachedCritiques(organizationId);
      if (!critiques || critiques.length === 0) return null;
      
      // Find the latest timestamp
      let latestTimestamp = null;
      critiques.forEach(critique => {
        if (critique.updatedAt && (!latestTimestamp || critique.updatedAt > latestTimestamp)) {
          latestTimestamp = critique.updatedAt;
        }
      });
      
      return latestTimestamp;
    } catch (error) {
      console.warn('Failed to get latest critique timestamp:', error);
      return null;
    }
  }

  getLatestFeedbackTimestamp(critiqueId) {
    try {
      const feedback = this.getCachedFeedback(critiqueId);
      if (!feedback || feedback.length === 0) return null;
      
      // Find the latest timestamp
      let latestTimestamp = null;
      feedback.forEach(fb => {
        if (fb.createdAt && (!latestTimestamp || fb.createdAt > latestTimestamp)) {
          latestTimestamp = fb.createdAt;
        }
      });
      
      return latestTimestamp;
    } catch (error) {
      console.warn('Failed to get latest feedback timestamp:', error);
      return null;
    }
  }

  // Serialization helpers to handle Firestore Timestamps
  serializeCritique(critique) {
    const serialized = { ...critique };
    
    // Convert Timestamp objects to ISO strings
    if (critique.createdAt instanceof Timestamp) {
      serialized.createdAt = critique.createdAt.toDate().toISOString();
    }
    if (critique.updatedAt instanceof Timestamp) {
      serialized.updatedAt = critique.updatedAt.toDate().toISOString();
    }
    
    // Remove non-serializable fields
    delete serialized._doc;
    
    return serialized;
  }

  deserializeCritique(critique) {
    const deserialized = { ...critique };
    
    // Convert ISO strings back to Date objects
    if (critique.createdAt && typeof critique.createdAt === 'string') {
      deserialized.createdAt = new Date(critique.createdAt);
    }
    if (critique.updatedAt && typeof critique.updatedAt === 'string') {
      deserialized.updatedAt = new Date(critique.updatedAt);
    }
    
    return deserialized;
  }

  serializeFeedback(feedback) {
    const serialized = { ...feedback };
    
    // Convert Timestamp objects to ISO strings
    if (feedback.createdAt instanceof Timestamp) {
      serialized.createdAt = feedback.createdAt.toDate().toISOString();
    }
    if (feedback.updatedAt instanceof Timestamp) {
      serialized.updatedAt = feedback.updatedAt.toDate().toISOString();
    }
    
    return serialized;
  }

  deserializeFeedback(feedback) {
    const deserialized = { ...feedback };
    
    // Convert ISO strings back to Date objects
    if (feedback.createdAt && typeof feedback.createdAt === 'string') {
      deserialized.createdAt = new Date(feedback.createdAt);
    }
    if (feedback.updatedAt && typeof feedback.updatedAt === 'string') {
      deserialized.updatedAt = new Date(feedback.updatedAt);
    }
    
    return deserialized;
  }

  // Append new critiques to cache (for incremental updates)
  appendCritiques(organizationId, newCritiques) {
    try {
      const existingCritiques = this.getCachedCritiques(organizationId) || [];
      
      // Create a map of existing critiques by ID for efficient lookup
      const existingMap = new Map(existingCritiques.map(c => [c.id, c]));
      
      // Update or add new critiques
      newCritiques.forEach(critique => {
        existingMap.set(critique.id, critique);
      });
      
      // Convert back to array and sort by creation date
      const updatedCritiques = Array.from(existingMap.values())
        .sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB - dateA; // Most recent first
        });
      
      this.setCachedCritiques(organizationId, updatedCritiques);
      return updatedCritiques;
    } catch (error) {
      console.warn('Failed to append critiques to cache:', error);
      return newCritiques;
    }
  }

  // Clear old caches to free up space
  clearOldCaches() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const data = JSON.parse(item);
              if (data.timestamp && now - data.timestamp > this.MAX_CACHE_AGE) {
                localStorage.removeItem(key);
              }
            }
          } catch (err) {
            // Remove invalid cache entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to clear old caches:', error);
    }
  }

  // Clear all critique-related caches
  clearAllCaches() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear all critique caches:', error);
    }
  }

  // Get cache statistics for monitoring
  getCacheStats() {
    try {
      const keys = Object.keys(localStorage);
      let totalSize = 0;
      let critiqueCount = 0;
      let feedbackCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += item.length;
            
            if (key.includes('critiques_')) {
              critiqueCount++;
            } else if (key.includes('feedback_')) {
              feedbackCount++;
            }
          }
        }
      });
      
      return {
        totalSizeKB: Math.round(totalSize / 1024),
        critiquesCached: critiqueCount,
        feedbackCached: feedbackCount
      };
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const photoCritiqueCacheService = new PhotoCritiqueCacheService();