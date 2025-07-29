import secureLogger from '../utils/secureLogger';

class FirestoreReadCounter {
  constructor() {
    this.counts = {
      session: {
        total: 0,
        byCollection: {},
        byOperation: {},
        byComponent: {},
        cacheHits: 0,
        cacheMisses: 0,
        cacheSavings: 0,
        startTime: Date.now()
      },
      daily: {
        total: 0,
        byCollection: {},
        byOperation: {},
        cacheHits: 0,
        cacheMisses: 0,
        cacheSavings: 0,
        date: this.getToday()
      },
      historical: []
    };
    
    this.listeners = new Set();
    // Always enable read counter for now (can still be disabled via localStorage)
    this.isEnabled = localStorage.getItem('enableReadCounter') !== 'false';
    
    // Load persisted data
    this.loadPersistedData();
    
    // Auto-save every 30 seconds
    this.saveInterval = setInterval(() => this.persistData(), 30000);
    
    // Reset daily counter at midnight
    this.checkDailyReset();
    this.dailyResetInterval = setInterval(() => this.checkDailyReset(), 60000); // Check every minute
  }

  getToday() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  loadPersistedData() {
    try {
      const saved = localStorage.getItem('firestoreReadCounts');
      if (saved) {
        const data = JSON.parse(saved);
        
        // Only load daily data if it's from today
        if (data.daily && data.daily.date === this.getToday()) {
          this.counts.daily = data.daily;
        }
        
        // Load historical data (last 30 days)
        if (data.historical && Array.isArray(data.historical)) {
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          this.counts.historical = data.historical.filter(entry => entry.timestamp > thirtyDaysAgo);
        }
        
        secureLogger.debug('Read counter data loaded:', this.counts);
      }
    } catch (error) {
      secureLogger.error('Error loading read counter data:', error);
    }
  }

  persistData() {
    try {
      const dataToSave = {
        daily: this.counts.daily,
        historical: this.counts.historical,
        lastSaved: Date.now()
      };
      localStorage.setItem('firestoreReadCounts', JSON.stringify(dataToSave));
    } catch (error) {
      secureLogger.error('Error persisting read counter data:', error);
    }
  }

  checkDailyReset() {
    const today = this.getToday();
    if (this.counts.daily.date !== today) {
      // Save yesterday's data to historical
      if (this.counts.daily.total > 0) {
        this.counts.historical.push({
          date: this.counts.daily.date,
          total: this.counts.daily.total,
          byCollection: { ...this.counts.daily.byCollection },
          byOperation: { ...this.counts.daily.byOperation },
          timestamp: Date.now()
        });
      }
      
      // Reset daily counter
      this.counts.daily = {
        total: 0,
        byCollection: {},
        byOperation: {},
        date: today
      };
      
      secureLogger.info('Daily read counter reset for', today);
    }
  }

  // Record a read operation
  recordRead(operation = 'unknown', collection = 'unknown', component = 'unknown', count = 1) {
    if (!this.isEnabled) return;

    try {
      // Session counts
      this.counts.session.total += count;
      this.counts.session.byCollection[collection] = (this.counts.session.byCollection[collection] || 0) + count;
      this.counts.session.byOperation[operation] = (this.counts.session.byOperation[operation] || 0) + count;
      this.counts.session.byComponent[component] = (this.counts.session.byComponent[component] || 0) + count;

      // Daily counts
      this.counts.daily.total += count;
      this.counts.daily.byCollection[collection] = (this.counts.daily.byCollection[collection] || 0) + count;
      this.counts.daily.byOperation[operation] = (this.counts.daily.byOperation[operation] || 0) + count;

      // Notify listeners
      this.notifyListeners();

      // Log significant reads (but not for initial estimates)
      if (count > 10 && operation !== 'onSnapshot-initial') {
        secureLogger.warn(`Large read operation: ${count} reads from ${collection} via ${operation} in ${component}`);
      }

      // Debug logging
      secureLogger.debug(`Read recorded: ${operation} on ${collection} (${count} reads) - Session total: ${this.counts.session.total}`);
    } catch (error) {
      secureLogger.error('Error recording read:', error);
    }
  }

  // Record a listener being created
  recordListener(collection, component, estimatedDocCount = 1) {
    if (!this.isEnabled) return;

    const listenerId = `${collection}-${component}-${Date.now()}`;
    this.listeners.add(listenerId);
    
    // Record initial read for listener setup
    this.recordRead('onSnapshot-initial', collection, component, estimatedDocCount);
    
    secureLogger.debug(`Listener created: ${listenerId} for ${collection} in ${component}`);
    return listenerId;
  }

  // Record a listener update
  recordListenerUpdate(listenerId, collection, component, docCount = 1) {
    if (!this.isEnabled || !this.listeners.has(listenerId)) return;

    this.recordRead('onSnapshot-update', collection, component, docCount);
    secureLogger.debug(`Listener update: ${listenerId} processed ${docCount} docs`);
  }

  // Record a listener being removed
  removeListener(listenerId) {
    if (!this.isEnabled) return;
    
    this.listeners.delete(listenerId);
    secureLogger.debug(`Listener removed: ${listenerId}`);
  }

  // Record cache hit (when data is loaded from cache instead of Firestore)
  recordCacheHit(collection = 'unknown', component = 'unknown', savedReads = 1) {
    if (!this.isEnabled) return;

    try {
      // Session counts
      this.counts.session.cacheHits += 1;
      this.counts.session.cacheSavings += savedReads;

      // Daily counts
      this.counts.daily.cacheHits += 1;
      this.counts.daily.cacheSavings += savedReads;

      // Notify listeners
      this.notifyListeners();

      secureLogger.debug(`Cache hit: ${collection} in ${component} (saved ${savedReads} reads)`);
    } catch (error) {
      secureLogger.error('Error recording cache hit:', error);
    }
  }

  // Record cache miss (when data must be fetched from Firestore)
  recordCacheMiss(collection = 'unknown', component = 'unknown') {
    if (!this.isEnabled) return;

    try {
      // Session counts
      this.counts.session.cacheMisses += 1;

      // Daily counts
      this.counts.daily.cacheMisses += 1;

      // Notify listeners
      this.notifyListeners();

      secureLogger.debug(`Cache miss: ${collection} in ${component}`);
    } catch (error) {
      secureLogger.error('Error recording cache miss:', error);
    }
  }

  // Get current statistics
  getStats() {
    const sessionDuration = (Date.now() - this.counts.session.startTime) / 1000; // seconds
    const readsPerSecond = sessionDuration > 0 ? this.counts.session.total / sessionDuration : 0;
    
    // Calculate costs (Firebase pricing: $0.36 per 100K reads)
    const sessionCost = (this.counts.session.total / 100000) * 0.36;
    const dailyCost = (this.counts.daily.total / 100000) * 0.36;
    
    // Calculate cache savings
    const sessionSavingsCost = (this.counts.session.cacheSavings / 100000) * 0.36;
    const dailySavingsCost = (this.counts.daily.cacheSavings / 100000) * 0.36;
    
    // Calculate cache hit rates
    const sessionCacheHitRate = this.counts.session.cacheHits + this.counts.session.cacheMisses > 0
      ? (this.counts.session.cacheHits / (this.counts.session.cacheHits + this.counts.session.cacheMisses)) * 100
      : 0;
      
    const dailyCacheHitRate = this.counts.daily.cacheHits + this.counts.daily.cacheMisses > 0
      ? (this.counts.daily.cacheHits / (this.counts.daily.cacheHits + this.counts.daily.cacheMisses)) * 100
      : 0;
    
    // Project monthly cost based on daily average
    const avgDailyReads = this.getAverageDailyReads();
    const projectedMonthlyCost = (avgDailyReads * 30 / 100000) * 0.36;

    return {
      session: {
        ...this.counts.session,
        duration: sessionDuration,
        readsPerSecond,
        cost: sessionCost,
        cacheHitRate: sessionCacheHitRate,
        savingsCost: sessionSavingsCost
      },
      daily: {
        ...this.counts.daily,
        cost: dailyCost,
        cacheHitRate: dailyCacheHitRate,
        savingsCost: dailySavingsCost
      },
      projections: {
        avgDailyReads,
        projectedMonthlyReads: avgDailyReads * 30,
        projectedMonthlyCost
      },
      listeners: {
        active: this.listeners.size,
        list: Array.from(this.listeners)
      },
      historical: this.counts.historical,
      cache: {
        session: {
          hits: this.counts.session.cacheHits,
          misses: this.counts.session.cacheMisses,
          hitRate: sessionCacheHitRate,
          savings: this.counts.session.cacheSavings,
          savingsCost: sessionSavingsCost
        },
        daily: {
          hits: this.counts.daily.cacheHits,
          misses: this.counts.daily.cacheMisses,
          hitRate: dailyCacheHitRate,
          savings: this.counts.daily.cacheSavings,
          savingsCost: dailySavingsCost
        }
      }
    };
  }

  getAverageDailyReads() {
    if (this.counts.historical.length === 0) {
      return this.counts.daily.total; // Use today's data if no historical data
    }
    
    const totalHistoricalReads = this.counts.historical.reduce((sum, day) => sum + day.total, 0);
    const totalDays = this.counts.historical.length;
    
    // Include today's partial data
    return (totalHistoricalReads + this.counts.daily.total) / (totalDays + 1);
  }

  // Subscribe to real-time updates
  subscribe(callback) {
    const listener = {
      id: Date.now() + Math.random(),
      callback
    };
    
    if (!this.updateListeners) {
      this.updateListeners = new Set();
    }
    
    this.updateListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  notifyListeners() {
    if (this.updateListeners) {
      const stats = this.getStats();
      this.updateListeners.forEach(listener => {
        try {
          listener.callback(stats);
        } catch (error) {
          secureLogger.error('Error in read counter listener:', error);
        }
      });
    }
  }

  // Reset session counter
  resetSession() {
    this.counts.session = {
      total: 0,
      byCollection: {},
      byOperation: {},
      byComponent: {},
      cacheHits: 0,
      cacheMisses: 0,
      cacheSavings: 0,
      startTime: Date.now()
    };
    this.notifyListeners();
    secureLogger.info('Session read counter reset');
  }

  // Reset daily counter
  resetDaily() {
    this.counts.daily = {
      total: 0,
      byCollection: {},
      byOperation: {},
      cacheHits: 0,
      cacheMisses: 0,
      cacheSavings: 0,
      date: this.getToday()
    };
    this.persistData(); // Save immediately to localStorage
    this.notifyListeners();
    secureLogger.info('Daily read counter reset');
  }

  // Enable/disable counter
  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('enableReadCounter', enabled.toString());
    secureLogger.info(`Read counter ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Export data for analysis
  exportData() {
    const data = {
      ...this.getStats(),
      exportTime: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firestore-reads-${this.getToday()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    secureLogger.info('Read counter data exported');
  }

  // Cleanup
  destroy() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.dailyResetInterval) {
      clearInterval(this.dailyResetInterval);
    }
    this.persistData();
    this.listeners.clear();
    if (this.updateListeners) {
      this.updateListeners.clear();
    }
  }
}

// Create singleton instance
const readCounter = new FirestoreReadCounter();

// Export the instance as a named export
export { readCounter };

// Wrapper functions for common Firestore operations
export const trackFirestoreRead = (operation, collection, component, count = 1) => {
  readCounter.recordRead(operation, collection, component, count);
};

export const trackFirestoreListener = (collection, component, estimatedDocCount = 1) => {
  return readCounter.recordListener(collection, component, estimatedDocCount);
};

export const trackListenerUpdate = (listenerId, collection, component, docCount = 1) => {
  readCounter.recordListenerUpdate(listenerId, collection, component, docCount);
};

export const removeFirestoreListener = (listenerId) => {
  readCounter.removeListener(listenerId);
};

// Enhanced logging functions
export const logFirestoreOperation = (operation, collection, result) => {
  if (result && result.docs) {
    // Query result
    trackFirestoreRead(operation, collection, 'unknown', result.docs.length);
  } else if (result && result.data) {
    // Single document
    trackFirestoreRead(operation, collection, 'unknown', 1);
  } else {
    // Unknown result type
    trackFirestoreRead(operation, collection, 'unknown', 1);
  }
};

export default readCounter;