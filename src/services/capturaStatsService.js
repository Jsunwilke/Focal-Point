// src/services/capturaStatsService.js
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit as firestoreLimit 
} from '../services/firestoreWrapper';
import { firestore } from '../firebase/config';
import { readCounter } from './readCounter';
import { functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

class CapturaStatsService {
  constructor() {
    this.CACHE_PREFIX = 'captura_stats_';
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get daily statistics
   */
  async getDailyStats(date) {
    const dateStr = this.formatDate(date);
    const cacheKey = `${this.CACHE_PREFIX}daily_${dateStr}`;
    
    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      readCounter.recordCacheHit('captura-stats', 'CapturaStatsService', 1);
      return cached;
    }
    
    readCounter.recordCacheMiss('captura-stats', 'CapturaStatsService');
    
    try {
      // Fetch from Firestore
      const docRef = doc(firestore, 'capturaOrderBatches', dateStr, 'summary', 'daily');
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      readCounter.recordRead('firestore', 'captura-stats-daily', 'CapturaStatsService', 1);
      
      // Cache the result
      this.setCachedData(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      readCounter.recordError('firestore', 'CapturaStatsService', error.message);
      throw error;
    }
  }

  /**
   * Get monthly statistics
   */
  async getMonthlyStats(year, month) {
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    const cacheKey = `${this.CACHE_PREFIX}monthly_${monthStr}`;
    
    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      readCounter.recordCacheHit('captura-stats', 'CapturaStatsService', 1);
      return cached;
    }
    
    readCounter.recordCacheMiss('captura-stats', 'CapturaStatsService');
    
    try {
      // Fetch from Firestore
      const docRef = doc(
        firestore, 
        'capturaOrderStats', 
        'monthly', 
        year.toString(), 
        monthStr
      );
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // If monthly stats don't exist, calculate from daily
        return await this.calculateMonthlyFromDaily(year, month);
      }
      
      const data = docSnap.data();
      readCounter.recordRead('firestore', 'captura-stats-monthly', 'CapturaStatsService', 1);
      
      // Cache the result
      this.setCachedData(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
      readCounter.recordError('firestore', 'CapturaStatsService', error.message);
      throw error;
    }
  }

  /**
   * Get yearly statistics
   */
  async getYearlyStats(year) {
    const cacheKey = `${this.CACHE_PREFIX}yearly_${year}`;
    
    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      readCounter.recordCacheHit('captura-stats', 'CapturaStatsService', 1);
      return cached;
    }
    
    readCounter.recordCacheMiss('captura-stats', 'CapturaStatsService');
    
    try {
      // Fetch from Firestore
      const docRef = doc(firestore, 'capturaOrderStats', 'yearly', year.toString());
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // If yearly stats don't exist, calculate from monthly
        return await this.calculateYearlyFromMonthly(year);
      }
      
      const data = docSnap.data();
      readCounter.recordRead('firestore', 'captura-stats-yearly', 'CapturaStatsService', 1);
      
      // Cache the result
      this.setCachedData(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching yearly stats:', error);
      readCounter.recordError('firestore', 'CapturaStatsService', error.message);
      throw error;
    }
  }

  /**
   * Get date range statistics
   */
  async getDateRangeStats(startDate, endDate) {
    const days = this.getDaysBetween(startDate, endDate);
    const dailyStats = [];
    
    // Fetch daily stats for each day
    for (const day of days) {
      const stats = await this.getDailyStats(day);
      if (stats) {
        dailyStats.push(stats);
      }
    }
    
    // Aggregate the results
    return this.aggregateDailyStats(dailyStats);
  }

  /**
   * Get order details for a specific day
   */
  async getDayOrders(date, batchIndex = null) {
    const dateStr = this.formatDate(date);
    
    try {
      if (batchIndex !== null) {
        // Fetch specific batch
        const batchRef = doc(
          firestore, 
          'capturaOrderBatches', 
          dateStr, 
          'batches', 
          `batch_${batchIndex}`
        );
        const batchDoc = await getDoc(batchRef);
        
        if (!batchDoc.exists()) {
          return [];
        }
        
        readCounter.recordRead('firestore', 'captura-order-batch', 'CapturaStatsService', 1);
        return batchDoc.data().orders || [];
        
      } else {
        // Fetch all batches for the day
        const batchesRef = collection(firestore, 'capturaOrderBatches', dateStr, 'batches');
        const batchesSnap = await getDocs(batchesRef);
        
        const allOrders = [];
        batchesSnap.forEach(doc => {
          const batchData = doc.data();
          allOrders.push(...(batchData.orders || []));
        });
        
        readCounter.recordRead(
          'firestore', 
          'captura-order-batches', 
          'CapturaStatsService', 
          batchesSnap.size
        );
        
        return allOrders;
      }
    } catch (error) {
      console.error('Error fetching day orders:', error);
      readCounter.recordError('firestore', 'CapturaStatsService', error.message);
      throw error;
    }
  }

  /**
   * Trigger manual sync for a date range
   */
  async triggerBackfill(startDate, endDate) {
    try {
      const backfillFunction = httpsCallable(functions, 'backfillHistoricalData');
      const result = await backfillFunction({
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate)
      });
      
      return result.data;
    } catch (error) {
      console.error('Error triggering backfill:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    try {
      const statusDoc = await getDoc(doc(firestore, 'capturaOrderSyncStatus', 'lastSync'));
      
      if (!statusDoc.exists()) {
        return null;
      }
      
      readCounter.recordRead('firestore', 'captura-sync-status', 'CapturaStatsService', 1);
      return statusDoc.data();
    } catch (error) {
      console.error('Error fetching sync status:', error);
      throw error;
    }
  }

  /**
   * Calculate monthly stats from daily summaries (fallback)
   */
  async calculateMonthlyFromDaily(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const days = this.getDaysBetween(startDate, endDate);
    
    const dailyStats = [];
    let readCount = 0;
    
    for (const day of days) {
      const stats = await this.getDailyStats(day);
      if (stats) {
        dailyStats.push(stats);
        readCount++;
      }
    }
    
    readCounter.recordRead(
      'firestore', 
      'captura-stats-daily-aggregate', 
      'CapturaStatsService', 
      readCount
    );
    
    return this.aggregateDailyStats(dailyStats);
  }

  /**
   * Calculate yearly stats from monthly summaries (fallback)
   */
  async calculateYearlyFromMonthly(year) {
    const monthlyStats = [];
    let readCount = 0;
    
    for (let month = 1; month <= 12; month++) {
      const stats = await this.getMonthlyStats(year, month);
      if (stats) {
        monthlyStats.push(stats);
        readCount++;
      }
    }
    
    readCounter.recordRead(
      'firestore', 
      'captura-stats-monthly-aggregate', 
      'CapturaStatsService', 
      readCount
    );
    
    return this.aggregateMonthlyStats(monthlyStats, year);
  }

  /**
   * Aggregate daily statistics
   */
  aggregateDailyStats(dailyStats) {
    const aggregated = {
      totalOrders: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageOrderValue: 0,
      ordersByGallery: {},
      ordersBySchool: {},
      topProducts: [],
      dateRange: {
        start: dailyStats[0]?.date,
        end: dailyStats[dailyStats.length - 1]?.date
      }
    };
    
    const galleryTotals = new Map();
    const schoolTotals = new Map();
    const productTotals = new Map();
    
    dailyStats.forEach(day => {
      aggregated.totalOrders += day.totalOrders || 0;
      aggregated.totalRevenue += day.totalRevenue || 0;
      aggregated.totalItems += day.totalItems || 0;
      
      // Aggregate galleries
      Object.entries(day.ordersByGallery || {}).forEach(([name, data]) => {
        if (!galleryTotals.has(name)) {
          galleryTotals.set(name, { count: 0, revenue: 0 });
        }
        const total = galleryTotals.get(name);
        total.count += data.count || 0;
        total.revenue += data.revenue || 0;
      });
      
      // Aggregate schools
      Object.entries(day.ordersBySchool || {}).forEach(([name, data]) => {
        if (!schoolTotals.has(name)) {
          schoolTotals.set(name, { count: 0, revenue: 0 });
        }
        const total = schoolTotals.get(name);
        total.count += data.count || 0;
        total.revenue += data.revenue || 0;
      });
      
      // Aggregate products
      (day.topProducts || []).forEach(product => {
        const key = product.sku || product.name;
        if (!productTotals.has(key)) {
          productTotals.set(key, { ...product, quantity: 0, revenue: 0 });
        }
        const total = productTotals.get(key);
        total.quantity += product.quantity || 0;
        total.revenue += product.revenue || 0;
      });
    });
    
    // Calculate averages
    aggregated.averageOrderValue = aggregated.totalOrders > 0
      ? aggregated.totalRevenue / aggregated.totalOrders
      : 0;
    
    // Convert maps to objects
    aggregated.ordersByGallery = Object.fromEntries(galleryTotals);
    aggregated.ordersBySchool = Object.fromEntries(schoolTotals);
    aggregated.topProducts = Array.from(productTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
    
    return aggregated;
  }

  /**
   * Aggregate monthly statistics
   */
  aggregateMonthlyStats(monthlyStats, year) {
    const aggregated = {
      year,
      totalOrders: 0,
      totalRevenue: 0,
      totalItems: 0,
      averageOrderValue: 0,
      monthlyStats: [],
      quarterlyStats: [],
      topGalleries: [],
      topSchools: [],
      topProducts: []
    };
    
    // Aggregate totals
    monthlyStats.forEach((month, index) => {
      aggregated.totalOrders += month.totalOrders || 0;
      aggregated.totalRevenue += month.totalRevenue || 0;
      aggregated.totalItems += month.totalItems || 0;
      
      aggregated.monthlyStats.push({
        month: index + 1,
        name: month.monthName,
        orders: month.totalOrders,
        revenue: month.totalRevenue,
        percentageOfYear: 0 // Will calculate after
      });
    });
    
    // Calculate percentages
    aggregated.monthlyStats.forEach(month => {
      month.percentageOfYear = aggregated.totalRevenue > 0
        ? (month.revenue / aggregated.totalRevenue) * 100
        : 0;
    });
    
    // Calculate quarterly stats
    for (let q = 0; q < 4; q++) {
      const quarterMonths = aggregated.monthlyStats.slice(q * 3, (q + 1) * 3);
      const quarterTotal = quarterMonths.reduce((sum, month) => ({
        orders: sum.orders + month.orders,
        revenue: sum.revenue + month.revenue
      }), { orders: 0, revenue: 0 });
      
      aggregated.quarterlyStats.push({
        quarter: q + 1,
        ...quarterTotal
      });
    }
    
    aggregated.averageOrderValue = aggregated.totalOrders > 0
      ? aggregated.totalRevenue / aggregated.totalOrders
      : 0;
    
    return aggregated;
  }

  /**
   * Cache management
   */
  getCachedData(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      
      // Check if cache is expired
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  setCachedData(key, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Cache write error:', error);
      // If localStorage is full, clear old cache entries
      this.clearOldCache();
    }
  }

  clearOldCache() {
    const keys = Object.keys(localStorage);
    const statsKeys = keys.filter(k => k.startsWith(this.CACHE_PREFIX));
    
    // Remove oldest entries
    statsKeys.sort().slice(0, Math.floor(statsKeys.length / 2)).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  /**
   * Clear all stats cache
   */
  clearCache() {
    const keys = Object.keys(localStorage);
    const statsKeys = keys.filter(k => k.startsWith(this.CACHE_PREFIX));
    statsKeys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Utility functions
   */
  formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDaysBetween(startDate, endDate) {
    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  /**
   * Format number
   */
  formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num || 0);
  }
}

export default new CapturaStatsService();