// src/services/proofingCacheService.js
import { readCounter } from './readCounter';

class ProofingCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_proofing_';
    this.GALLERIES_KEY = 'galleries';
    this.PROOFS_KEY = 'proofs';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  // Generate cache key
  getCacheKey(type, identifier) {
    return `${this.CACHE_PREFIX}${type}_${identifier}_v${this.CACHE_VERSION}`;
  }

  // Check if cache is valid
  isCacheValid(cachedData) {
    if (!cachedData || !cachedData.timestamp) return false;
    const age = Date.now() - cachedData.timestamp;
    return age < this.MAX_CACHE_AGE;
  }

  // Get cached galleries for an organization
  getCachedGalleries(organizationId) {
    try {
      const key = this.getCacheKey(this.GALLERIES_KEY, organizationId);
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const parsedCache = JSON.parse(cached);
      
      if (!this.isCacheValid(parsedCache)) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsedCache.data;
    } catch (error) {
      console.error('Error reading galleries cache:', error);
      return null;
    }
  }

  // Set cached galleries
  setCachedGalleries(organizationId, galleries) {
    try {
      const key = this.getCacheKey(this.GALLERIES_KEY, organizationId);
      const cacheData = {
        data: galleries,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting galleries cache:', error);
      // If storage is full, try to clear old data
      this.clearOldCache();
    }
  }

  // Get cached proofs for a gallery
  getCachedProofs(galleryId) {
    try {
      const key = this.getCacheKey(this.PROOFS_KEY, galleryId);
      const cached = localStorage.getItem(key);
      
      if (!cached) return null;
      
      const parsedCache = JSON.parse(cached);
      
      if (!this.isCacheValid(parsedCache)) {
        localStorage.removeItem(key);
        return null;
      }
      
      return parsedCache.data;
    } catch (error) {
      console.error('Error reading proofs cache:', error);
      return null;
    }
  }

  // Set cached proofs
  setCachedProofs(galleryId, proofs) {
    try {
      const key = this.getCacheKey(this.PROOFS_KEY, galleryId);
      const cacheData = {
        data: proofs,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting proofs cache:', error);
      this.clearOldCache();
    }
  }

  // Update a single proof in cache
  updateCachedProof(galleryId, proofId, updates) {
    try {
      const proofs = this.getCachedProofs(galleryId);
      if (!proofs) return;
      
      const proofIndex = proofs.findIndex(p => p.id === proofId);
      if (proofIndex === -1) return;
      
      proofs[proofIndex] = { ...proofs[proofIndex], ...updates };
      this.setCachedProofs(galleryId, proofs);
    } catch (error) {
      console.error('Error updating cached proof:', error);
    }
  }

  // Clear cache for a specific gallery
  clearGalleryCache(galleryId) {
    try {
      const proofsKey = this.getCacheKey(this.PROOFS_KEY, galleryId);
      localStorage.removeItem(proofsKey);
    } catch (error) {
      console.error('Error clearing gallery cache:', error);
    }
  }

  // Clear all proofing cache
  clearAllCache() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing all proofing cache:', error);
    }
  }

  // Clear old cache entries
  clearOldCache() {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          try {
            const cached = JSON.parse(localStorage.getItem(key));
            if (!this.isCacheValid(cached)) {
              localStorage.removeItem(key);
              clearedCount++;
            }
          } catch (e) {
            // Invalid JSON, remove it
            localStorage.removeItem(key);
            clearedCount++;
          }
        }
      });
      
      console.log(`Cleared ${clearedCount} old proofing cache entries`);
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    try {
      const stats = {
        totalEntries: 0,
        totalSize: 0,
        galleries: 0,
        proofs: 0
      };
      
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.CACHE_PREFIX)) {
          stats.totalEntries++;
          const value = localStorage.getItem(key);
          stats.totalSize += value.length;
          
          if (key.includes(this.GALLERIES_KEY)) stats.galleries++;
          if (key.includes(this.PROOFS_KEY)) stats.proofs++;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const proofingCacheService = new ProofingCacheService();