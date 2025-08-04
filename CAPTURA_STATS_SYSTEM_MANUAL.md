# Captura Stats System Implementation Manual

## Table of Contents
1. [System Overview](#system-overview)
2. [Problem Statement](#problem-statement)
3. [Architecture Design](#architecture-design)
4. [Firestore Data Structure](#firestore-data-structure)
5. [Cloud Functions Implementation](#cloud-functions-implementation)
6. [Client-Side Implementation](#client-side-implementation)
7. [Performance Optimization](#performance-optimization)
8. [Deployment Guide](#deployment-guide)
9. [Maintenance and Monitoring](#maintenance-and-monitoring)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

The Captura Stats System is a server-side solution designed to aggregate and analyze order data from the Captura API while working within its 5000-order limit constraint. The system uses Firebase Cloud Functions to fetch data in batches, stores it efficiently in Firestore, and provides fast access to pre-calculated statistics.

### Key Components:
- **Firebase Cloud Functions**: Automated data fetching and aggregation
- **Firestore**: Batched storage with pre-calculated summaries
- **Client Service**: Efficient data retrieval with caching
- **Stats UI**: Interactive dashboard with drill-down capabilities

---

## Problem Statement

### Constraints:
1. Captura API limits responses to 5000 orders per request
2. A full year of data may contain 50,000+ orders
3. Individual order API calls are needed for complete data
4. Client-side fetching would be slow and expensive

### Solution Requirements:
- Fetch all orders without hitting API limits
- Minimize Firestore reads for statistics
- Provide real-time stats without delays
- Allow drill-down to individual order details
- Maintain data freshness with automated updates

---

## Architecture Design

### Data Flow:
```
Captura API → Cloud Functions → Firestore Batches → Pre-calculated Stats → Client UI
```

### Storage Strategy:
1. **Batch Storage**: Store orders in groups of 500 per document
2. **Daily Summaries**: Pre-calculated stats for each day
3. **Monthly/Yearly Rollups**: Aggregated from daily summaries
4. **Minimal Reads**: 1 read for daily stats, 30 for monthly, 365 for yearly

---

## Firestore Data Structure

### Collections and Documents:

```javascript
// 1. Order Batches Collection
capturaOrderBatches/
  └── {date: "2025-01-15"}/
      └── batches/
          └── batch_1/
              {
                orders: [
                  {
                    id: "43981208",
                    orderNumber: "ORD-2025-001",
                    customerName: "John Doe",
                    customerEmail: "john@example.com",
                    orderDate: "2025-01-15",
                    total: 178.28,
                    subtotal: 199.00,
                    tax: 18.08,
                    shipping: 1.00,
                    discount: -39.80,
                    paymentStatus: "processed",
                    items: [...],
                    galleryOrders: [...],
                    // Full order data from individual API call
                  },
                  // ... up to 500 orders
                ],
                count: 500,
                totalAmount: 89140.00,
                dateRange: {
                  start: "2025-01-15T00:00:00Z",
                  end: "2025-01-15T11:59:59Z"
                }
              }
          └── batch_2/
              {
                orders: [...],
                count: 347,
                totalAmount: 61723.50,
                dateRange: {
                  start: "2025-01-15T12:00:00Z",
                  end: "2025-01-15T23:59:59Z"
                }
              }
      └── summary/
          └── daily/
              {
                date: "2025-01-15",
                dayOfWeek: "Monday",
                totalOrders: 847,
                totalRevenue: 150863.50,
                totalItems: 2541,
                averageOrderValue: 178.13,
                
                // Hourly breakdown
                ordersByHour: {
                  "00": { count: 12, revenue: 2136.00 },
                  "01": { count: 8, revenue: 1424.00 },
                  // ... all 24 hours
                },
                
                // Gallery breakdown
                ordersByGallery: {
                  "Spring Sports 2025": {
                    count: 234,
                    revenue: 41652.00,
                    items: 702,
                    averageOrder: 178.00
                  },
                  "School Portraits Fall": {
                    count: 189,
                    revenue: 33642.00,
                    items: 567,
                    averageOrder: 178.00
                  },
                  // ... all galleries
                },
                
                // School breakdown
                ordersBySchool: {
                  "Lincoln High School": {
                    count: 156,
                    revenue: 27768.00,
                    topGallery: "Spring Sports 2025"
                  },
                  // ... all schools
                },
                
                // Payment status
                paymentBreakdown: {
                  "processed": {
                    count: 820,
                    amount: 145920.00,
                    percentage: 96.8
                  },
                  "pending": {
                    count: 27,
                    amount: 4943.50,
                    percentage: 3.2
                  }
                },
                
                // Product breakdown (top 20)
                topProducts: [
                  {
                    name: "Package B",
                    sku: "PKG-B-001",
                    quantity: 234,
                    revenue: 10998.00
                  },
                  // ... top 20 products
                ],
                
                // Customer insights
                customerMetrics: {
                  uniqueCustomers: 712,
                  repeatCustomers: 89,
                  newCustomers: 623,
                  averageItemsPerOrder: 3.0
                },
                
                // For drill-down
                batchIds: ["batch_1", "batch_2"],
                
                // Metadata
                lastUpdated: "2025-01-16T02:00:00Z",
                processingTime: 45.2, // seconds
                apiCalls: 848, // 1 list + 847 individual
              }

// 2. Monthly Stats Collection
capturaOrderStats/
  └── monthly/
      └── 2025-01/
          {
            year: 2025,
            month: 1,
            monthName: "January",
            totalOrders: 26257,
            totalRevenue: 4676328.50,
            totalItems: 78771,
            averageOrderValue: 178.13,
            
            // Daily summary
            dailyStats: [
              { date: "2025-01-01", orders: 523, revenue: 93111.00 },
              { date: "2025-01-02", orders: 892, revenue: 158876.00 },
              // ... all days
            ],
            
            // Weekly summary
            weeklyStats: [
              { week: 1, orders: 6234, revenue: 1110462.00 },
              { week: 2, orders: 6891, revenue: 1227699.00 },
              // ... all weeks
            ],
            
            // Top performers
            topGalleries: [
              {
                name: "Spring Sports 2025",
                orders: 7234,
                revenue: 1288452.00,
                percentage: 27.5
              },
              // ... top 10
            ],
            
            topSchools: [...],
            topProducts: [...],
            
            // Growth metrics
            growthMetrics: {
              ordersVsPreviousMonth: 12.5, // percentage
              revenueVsPreviousMonth: 15.2,
              ordersVsPreviousYear: 24.1,
              revenueVsPreviousYear: 28.7
            },
            
            // Trends
            trends: {
              busiestDay: "2025-01-15",
              slowestDay: "2025-01-01",
              peakHour: 14, // 2 PM
              averageOrdersPerDay: 847
            },
            
            lastUpdated: "2025-02-01T03:00:00Z"
          }

// 3. Yearly Stats Collection  
capturaOrderStats/
  └── yearly/
      └── 2025/
          {
            year: 2025,
            totalOrders: 315084,
            totalRevenue: 56115952.00,
            totalItems: 945252,
            averageOrderValue: 178.13,
            
            // Monthly breakdown
            monthlyStats: [
              {
                month: 1,
                name: "January",
                orders: 26257,
                revenue: 4676328.50,
                percentageOfYear: 8.3
              },
              // ... all 12 months
            ],
            
            // Quarterly breakdown
            quarterlyStats: [
              {
                quarter: 1,
                orders: 78234,
                revenue: 13935442.00,
                growth: 0 // base quarter
              },
              // ... all 4 quarters
            ],
            
            // Top performers for the year
            topGalleries: [...],
            topSchools: [...],
            topProducts: [...],
            topCustomers: [...],
            
            // Seasonal insights
            seasonalTrends: {
              peakMonth: "May",
              slowestMonth: "July",
              springOrders: 98234,
              fallOrders: 112456
            },
            
            lastUpdated: "2025-12-31T23:59:59Z"
          }

// 4. Sync Status Collection
capturaOrderSyncStatus/
  └── syncHistory/
      └── {timestamp}/
          {
            startTime: "2025-01-16T02:00:00Z",
            endTime: "2025-01-16T02:45:32Z",
            status: "completed",
            ordersProcessed: 847,
            batchesCreated: 2,
            errors: [],
            dateRange: {
              start: "2025-01-15",
              end: "2025-01-15"
            }
          }
  └── lastSync/
      {
        timestamp: "2025-01-16T02:45:32Z",
        status: "completed",
        nextScheduled: "2025-01-17T02:00:00Z"
      }
  └── configuration/
      {
        syncEnabled: true,
        syncHour: 2, // 2 AM
        retryAttempts: 3,
        batchSize: 500,
        apiRateLimit: 100 // requests per minute
      }
```

---

## Cloud Functions Implementation

### 1. Main Sync Function (Scheduled Daily)

```javascript
// functions/capturaStats.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();
const BATCH_SIZE = 500;
const API_LIMIT = 5000;

/**
 * Scheduled function to sync daily orders
 * Runs every day at 2 AM
 */
exports.syncDailyOrders = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('America/Chicago')
  .onRun(async (context) => {
    const syncStart = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    
    try {
      console.log(`Starting daily sync for ${dateStr}`);
      
      // Step 1: Fetch all order IDs for the date
      const orderList = await fetchAllOrdersForDate(dateStr);
      console.log(`Found ${orderList.length} orders for ${dateStr}`);
      
      // Step 2: Fetch detailed data for each order
      const detailedOrders = await fetchOrderDetails(orderList);
      
      // Step 3: Batch and store orders
      await batchAndStoreOrders(dateStr, detailedOrders);
      
      // Step 4: Calculate and store daily summary
      const summary = calculateDailySummary(dateStr, detailedOrders);
      await storeDailySummary(dateStr, summary);
      
      // Step 5: Update monthly stats
      await updateMonthlyStats(yesterday);
      
      // Step 6: Log success
      await logSyncStatus(syncStart, 'completed', orderList.length);
      
      return { success: true, ordersProcessed: orderList.length };
      
    } catch (error) {
      console.error('Sync failed:', error);
      await logSyncStatus(syncStart, 'failed', 0, error.message);
      throw error;
    }
  });

/**
 * Fetch all orders for a specific date, handling 5000 limit
 */
async function fetchAllOrdersForDate(dateStr) {
  const allOrders = [];
  let start = 1;
  let hasMore = true;
  
  while (hasMore) {
    const batch = await fetchOrderBatch(dateStr, dateStr, start, start + API_LIMIT - 1);
    allOrders.push(...batch.orders);
    
    if (batch.orders.length < API_LIMIT) {
      hasMore = false;
    } else {
      start += API_LIMIT;
      // Add delay to respect rate limits
      await sleep(1000);
    }
  }
  
  return allOrders;
}

/**
 * Fetch a batch of orders from Captura API
 */
async function fetchOrderBatch(startDate, endDate, start, end) {
  const accessToken = await getCapturaAccessToken();
  const accountId = process.env.CAPTURA_ACCOUNT_ID || 'J98TA9W';
  
  const params = new URLSearchParams({
    start: start.toString(),
    end: end.toString(),
    orderStartDate: startDate,
    orderEndDate: endDate
  });
  
  const url = `https://api.imagequix.com/api/v1/account/${accountId}/order?${params}`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

/**
 * Fetch detailed order information for each order
 */
async function fetchOrderDetails(orderList) {
  const detailedOrders = [];
  const batchSize = 10; // Process 10 orders at a time to avoid timeout
  
  for (let i = 0; i < orderList.length; i += batchSize) {
    const batch = orderList.slice(i, i + batchSize);
    const promises = batch.map(order => fetchSingleOrderDetail(order.id));
    
    const results = await Promise.all(promises);
    detailedOrders.push(...results);
    
    // Rate limiting
    if (i + batchSize < orderList.length) {
      await sleep(500);
    }
  }
  
  return detailedOrders;
}

/**
 * Fetch single order detail
 */
async function fetchSingleOrderDetail(orderId) {
  try {
    const accessToken = await getCapturaAccessToken();
    const accountId = process.env.CAPTURA_ACCOUNT_ID || 'J98TA9W';
    const url = `https://api.imagequix.com/api/v1/account/${accountId}/order/${orderId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch order ${orderId}:`, error.message);
    return null;
  }
}

/**
 * Batch orders and store in Firestore
 */
async function batchAndStoreOrders(dateStr, orders) {
  const validOrders = orders.filter(o => o !== null);
  const batches = [];
  
  // Sort orders by timestamp for consistent batching
  validOrders.sort((a, b) => 
    new Date(a.orderDate + ' ' + a.orderTime) - 
    new Date(b.orderDate + ' ' + b.orderTime)
  );
  
  // Create batches
  for (let i = 0; i < validOrders.length; i += BATCH_SIZE) {
    batches.push(validOrders.slice(i, i + BATCH_SIZE));
  }
  
  // Store each batch
  const batchRefs = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchId = `batch_${i + 1}`;
    
    const batchData = {
      orders: batch,
      count: batch.length,
      totalAmount: batch.reduce((sum, order) => sum + (order.total || 0), 0),
      dateRange: {
        start: batch[0].orderDate + 'T' + batch[0].orderTime,
        end: batch[batch.length - 1].orderDate + 'T' + batch[batch.length - 1].orderTime
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('capturaOrderBatches')
      .doc(dateStr)
      .collection('batches')
      .doc(batchId)
      .set(batchData);
    
    batchRefs.push(batchId);
  }
  
  return batchRefs;
}

/**
 * Calculate comprehensive daily summary
 */
function calculateDailySummary(dateStr, orders) {
  const summary = {
    date: dateStr,
    dayOfWeek: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
    totalOrders: orders.length,
    totalRevenue: 0,
    totalItems: 0,
    averageOrderValue: 0,
    ordersByHour: {},
    ordersByGallery: {},
    ordersBySchool: {},
    paymentBreakdown: {},
    topProducts: [],
    customerMetrics: {
      uniqueCustomers: 0,
      repeatCustomers: 0,
      newCustomers: 0,
      averageItemsPerOrder: 0
    }
  };
  
  // Initialize hourly buckets
  for (let hour = 0; hour < 24; hour++) {
    summary.ordersByHour[hour.toString().padStart(2, '0')] = {
      count: 0,
      revenue: 0
    };
  }
  
  // Process each order
  const customerMap = new Map();
  const productMap = new Map();
  const galleryMap = new Map();
  const schoolMap = new Map();
  const paymentMap = new Map();
  
  orders.forEach(order => {
    if (!order) return;
    
    // Basic metrics
    summary.totalRevenue += order.total || 0;
    summary.totalItems += order.items?.length || 0;
    
    // Hourly breakdown
    const hour = new Date(order.orderDate + ' ' + order.orderTime)
      .getHours().toString().padStart(2, '0');
    summary.ordersByHour[hour].count++;
    summary.ordersByHour[hour].revenue += order.total || 0;
    
    // Customer tracking
    const customerId = order.customerEmail || order.customerId;
    if (customerId) {
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, { orders: 0, revenue: 0 });
      }
      const customer = customerMap.get(customerId);
      customer.orders++;
      customer.revenue += order.total || 0;
    }
    
    // Gallery breakdown
    order.galleryOrders?.forEach(go => {
      const galleryName = go.gallery?.title || go.gallery?.name || 'Unknown';
      if (!galleryMap.has(galleryName)) {
        galleryMap.set(galleryName, {
          count: 0,
          revenue: 0,
          items: 0
        });
      }
      const gallery = galleryMap.get(galleryName);
      gallery.count++;
      gallery.revenue += go.total || 0;
      gallery.items += go.items?.length || 0;
    });
    
    // School breakdown
    const schoolName = order.school || order.galleryOrders?.[0]?.school || 'Unknown';
    if (!schoolMap.has(schoolName)) {
      schoolMap.set(schoolName, {
        count: 0,
        revenue: 0,
        galleries: new Set()
      });
    }
    const school = schoolMap.get(schoolName);
    school.count++;
    school.revenue += order.total || 0;
    order.galleryOrders?.forEach(go => {
      const galleryName = go.gallery?.title || go.gallery?.name;
      if (galleryName) school.galleries.add(galleryName);
    });
    
    // Payment status
    const paymentStatus = order.paymentStatus || 'unknown';
    if (!paymentMap.has(paymentStatus)) {
      paymentMap.set(paymentStatus, { count: 0, amount: 0 });
    }
    const payment = paymentMap.get(paymentStatus);
    payment.count++;
    payment.amount += order.total || 0;
    
    // Product tracking
    order.items?.forEach(item => {
      const productKey = item.sku || item.productId || item.name;
      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          name: item.name || item.description,
          sku: item.sku,
          quantity: 0,
          revenue: 0
        });
      }
      const product = productMap.get(productKey);
      product.quantity += item.quantity || 1;
      product.revenue += (item.quantity || 1) * (item.price || 0);
    });
  });
  
  // Calculate derived metrics
  summary.averageOrderValue = summary.totalOrders > 0 
    ? summary.totalRevenue / summary.totalOrders 
    : 0;
  
  summary.customerMetrics.uniqueCustomers = customerMap.size;
  summary.customerMetrics.repeatCustomers = 
    Array.from(customerMap.values()).filter(c => c.orders > 1).length;
  summary.customerMetrics.newCustomers = 
    summary.customerMetrics.uniqueCustomers - summary.customerMetrics.repeatCustomers;
  summary.customerMetrics.averageItemsPerOrder = 
    summary.totalOrders > 0 ? summary.totalItems / summary.totalOrders : 0;
  
  // Convert maps to summary objects
  summary.ordersByGallery = Object.fromEntries(
    Array.from(galleryMap.entries()).map(([name, data]) => [
      name, 
      { ...data, averageOrder: data.count > 0 ? data.revenue / data.count : 0 }
    ])
  );
  
  summary.ordersBySchool = Object.fromEntries(
    Array.from(schoolMap.entries()).map(([name, data]) => [
      name,
      {
        count: data.count,
        revenue: data.revenue,
        topGallery: data.galleries.size > 0 ? Array.from(data.galleries)[0] : null
      }
    ])
  );
  
  summary.paymentBreakdown = Object.fromEntries(
    Array.from(paymentMap.entries()).map(([status, data]) => [
      status,
      {
        ...data,
        percentage: summary.totalOrders > 0 
          ? (data.count / summary.totalOrders) * 100 
          : 0
      }
    ])
  );
  
  // Get top 20 products
  summary.topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);
  
  return summary;
}

/**
 * Store daily summary in Firestore
 */
async function storeDailySummary(dateStr, summary) {
  summary.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
  
  await db.collection('capturaOrderBatches')
    .doc(dateStr)
    .collection('summary')
    .doc('daily')
    .set(summary);
}

/**
 * Update monthly statistics
 */
async function updateMonthlyStats(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  
  // Get all daily summaries for the month
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const dailySummaries = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const summaryDoc = await db.collection('capturaOrderBatches')
      .doc(dateStr)
      .collection('summary')
      .doc('daily')
      .get();
    
    if (summaryDoc.exists) {
      dailySummaries.push(summaryDoc.data());
    }
  }
  
  if (dailySummaries.length === 0) return;
  
  // Calculate monthly aggregates
  const monthlyStats = {
    year,
    month: month + 1,
    monthName: date.toLocaleDateString('en-US', { month: 'long' }),
    totalOrders: 0,
    totalRevenue: 0,
    totalItems: 0,
    averageOrderValue: 0,
    dailyStats: [],
    weeklyStats: [],
    topGalleries: [],
    topSchools: [],
    topProducts: [],
    growthMetrics: {},
    trends: {},
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Aggregate daily data
  const galleryTotals = new Map();
  const schoolTotals = new Map();
  const productTotals = new Map();
  
  dailySummaries.forEach(day => {
    monthlyStats.totalOrders += day.totalOrders;
    monthlyStats.totalRevenue += day.totalRevenue;
    monthlyStats.totalItems += day.totalItems;
    
    monthlyStats.dailyStats.push({
      date: day.date,
      orders: day.totalOrders,
      revenue: day.totalRevenue
    });
    
    // Aggregate galleries
    Object.entries(day.ordersByGallery || {}).forEach(([name, data]) => {
      if (!galleryTotals.has(name)) {
        galleryTotals.set(name, { orders: 0, revenue: 0 });
      }
      const total = galleryTotals.get(name);
      total.orders += data.count;
      total.revenue += data.revenue;
    });
    
    // Aggregate schools
    Object.entries(day.ordersBySchool || {}).forEach(([name, data]) => {
      if (!schoolTotals.has(name)) {
        schoolTotals.set(name, { orders: 0, revenue: 0 });
      }
      const total = schoolTotals.get(name);
      total.orders += data.count;
      total.revenue += data.revenue;
    });
    
    // Aggregate products
    (day.topProducts || []).forEach(product => {
      const key = product.sku || product.name;
      if (!productTotals.has(key)) {
        productTotals.set(key, {
          name: product.name,
          sku: product.sku,
          quantity: 0,
          revenue: 0
        });
      }
      const total = productTotals.get(key);
      total.quantity += product.quantity;
      total.revenue += product.revenue;
    });
  });
  
  // Calculate averages and rankings
  monthlyStats.averageOrderValue = monthlyStats.totalOrders > 0
    ? monthlyStats.totalRevenue / monthlyStats.totalOrders
    : 0;
  
  monthlyStats.topGalleries = Array.from(galleryTotals.entries())
    .map(([name, data]) => ({
      name,
      orders: data.orders,
      revenue: data.revenue,
      percentage: (data.revenue / monthlyStats.totalRevenue) * 100
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  monthlyStats.topSchools = Array.from(schoolTotals.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  monthlyStats.topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);
  
  // Calculate weekly stats
  const weekMap = new Map();
  dailySummaries.forEach(day => {
    const weekNum = getWeekNumber(new Date(day.date));
    if (!weekMap.has(weekNum)) {
      weekMap.set(weekNum, { orders: 0, revenue: 0 });
    }
    const week = weekMap.get(weekNum);
    week.orders += day.totalOrders;
    week.revenue += day.totalRevenue;
  });
  
  monthlyStats.weeklyStats = Array.from(weekMap.entries())
    .map(([week, data]) => ({ week, ...data }))
    .sort((a, b) => a.week - b.week);
  
  // Calculate trends
  const sortedDaily = [...monthlyStats.dailyStats].sort((a, b) => b.orders - a.orders);
  monthlyStats.trends = {
    busiestDay: sortedDaily[0]?.date,
    slowestDay: sortedDaily[sortedDaily.length - 1]?.date,
    averageOrdersPerDay: monthlyStats.totalOrders / dailySummaries.length
  };
  
  // TODO: Calculate growth metrics by comparing with previous month/year
  
  // Store monthly stats
  await db.collection('capturaOrderStats')
    .doc('monthly')
    .collection(year.toString())
    .doc(monthStr)
    .set(monthlyStats);
}

/**
 * Manual backfill function - callable
 */
exports.backfillHistoricalData = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  
  const { startDate, endDate } = data;
  if (!startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Start and end dates required');
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = [];
  
  // Process each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    
    try {
      console.log(`Backfilling ${dateStr}`);
      
      // Check if already processed
      const existing = await db.collection('capturaOrderBatches')
        .doc(dateStr)
        .collection('summary')
        .doc('daily')
        .get();
      
      if (existing.exists) {
        results.push({ date: dateStr, status: 'skipped', reason: 'already exists' });
        continue;
      }
      
      // Process the day
      const orderList = await fetchAllOrdersForDate(dateStr);
      const detailedOrders = await fetchOrderDetails(orderList);
      await batchAndStoreOrders(dateStr, detailedOrders);
      const summary = calculateDailySummary(dateStr, detailedOrders);
      await storeDailySummary(dateStr, summary);
      
      results.push({ 
        date: dateStr, 
        status: 'completed', 
        orders: orderList.length 
      });
      
      // Rate limiting between days
      await sleep(2000);
      
    } catch (error) {
      console.error(`Failed to backfill ${dateStr}:`, error);
      results.push({ 
        date: dateStr, 
        status: 'failed', 
        error: error.message 
      });
    }
  }
  
  // Update monthly stats for affected months
  const months = new Set();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    months.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  
  for (const monthKey of months) {
    const [year, month] = monthKey.split('-').map(Number);
    await updateMonthlyStats(new Date(year, month, 15));
  }
  
  return { success: true, results };
});

/**
 * Utility functions
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function getCapturaAccessToken() {
  // Implementation from existing code
  // Returns valid access token
}

async function logSyncStatus(startTime, status, ordersProcessed, error = null) {
  const syncData = {
    startTime: startTime.toISOString(),
    endTime: new Date().toISOString(),
    status,
    ordersProcessed,
    processingTime: (new Date() - startTime) / 1000, // seconds
    errors: error ? [error] : []
  };
  
  // Log to history
  await db.collection('capturaOrderSyncStatus')
    .doc('syncHistory')
    .collection('logs')
    .doc(startTime.toISOString())
    .set(syncData);
  
  // Update last sync
  await db.collection('capturaOrderSyncStatus')
    .doc('lastSync')
    .set({
      timestamp: new Date().toISOString(),
      status,
      nextScheduled: status === 'completed' 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null
    });
}
```

### 2. Update functions/index.js

```javascript
// Add to functions/index.js
const capturaStats = require('./capturaStats');

// Export the functions
exports.syncDailyOrders = capturaStats.syncDailyOrders;
exports.backfillHistoricalData = capturaStats.backfillHistoricalData;
```

---

## Client-Side Implementation

### 1. Captura Stats Service

```javascript
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
}

export default new CapturaStatsService();
```

### 2. Stats Page Component

```javascript
// src/pages/CapturaStats.js
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import capturaStatsService from '../services/capturaStatsService';
import { readCounter } from '../services/readCounter';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  Package,
  Users,
  RefreshCw,
  Download,
  ChevronRight,
  Loader2
} from 'lucide-react';
import './CapturaStats.css';

const CapturaStats = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [stats, setStats] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  // Load stats on mount and when period/date changes
  useEffect(() => {
    loadStats();
    loadSyncStatus();
  }, [selectedPeriod, selectedDate]);

  const loadStats = async () => {
    setLoading(true);
    try {
      let data;
      
      switch (selectedPeriod) {
        case 'day':
          data = await capturaStatsService.getDailyStats(selectedDate);
          break;
        case 'month':
          data = await capturaStatsService.getMonthlyStats(
            selectedDate.getFullYear(),
            selectedDate.getMonth() + 1
          );
          break;
        case 'year':
          data = await capturaStatsService.getYearlyStats(
            selectedDate.getFullYear()
          );
          break;
        default:
          // Custom date range
          const { start, end } = getDateRange();
          data = await capturaStatsService.getDateRangeStats(start, end);
      }
      
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await capturaStatsService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear cache and reload
      localStorage.removeItem(`captura_stats_${selectedPeriod}_${formatDateKey()}`);
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = () => {
    // Generate CSV or PDF report
    if (!stats) return;
    
    const csv = generateCSV(stats);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captura-stats-${formatDateKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDateKey = () => {
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    
    switch (selectedPeriod) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'month':
        return `${year}-${month}`;
      case 'year':
        return year.toString();
      default:
        return `custom`;
    }
  };

  const getDateRange = () => {
    const now = new Date();
    let start, end;
    
    switch (selectedPeriod) {
      case 'week':
        start = new Date(selectedDate);
        start.setDate(selectedDate.getDate() - selectedDate.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      case 'quarter':
        const quarter = Math.floor(selectedDate.getMonth() / 3);
        start = new Date(selectedDate.getFullYear(), quarter * 3, 1);
        end = new Date(selectedDate.getFullYear(), quarter * 3 + 3, 0);
        break;
      default:
        start = end = selectedDate;
    }
    
    return { start, end };
  };

  const generateCSV = (data) => {
    const rows = [
      ['Captura Order Statistics'],
      ['Period:', formatDateKey()],
      ['Generated:', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Total Orders:', data.totalOrders],
      ['Total Revenue:', formatCurrency(data.totalRevenue)],
      ['Average Order Value:', formatCurrency(data.averageOrderValue)],
      ['Total Items:', data.totalItems],
      [],
      ['Top Galleries'],
      ['Gallery', 'Orders', 'Revenue', 'Percentage']
    ];
    
    // Add top galleries
    (data.topGalleries || []).forEach(gallery => {
      rows.push([
        gallery.name,
        gallery.orders || gallery.count,
        formatCurrency(gallery.revenue),
        `${gallery.percentage?.toFixed(1)}%`
      ]);
    });
    
    // Convert to CSV string
    return rows.map(row => row.map(cell => 
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(',')).join('\n');
  };

  if (loading) {
    return (
      <div className="captura-stats__loading">
        <Loader2 className="captura-stats__spinner" />
        <p>Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="captura-stats">
      {/* Header */}
      <div className="captura-stats__header">
        <h1>Order Statistics</h1>
        <div className="captura-stats__actions">
          <button 
            className="captura-stats__refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? 'spinning' : ''} size={16} />
            Refresh
          </button>
          <button 
            className="captura-stats__export-btn"
            onClick={handleExport}
            disabled={!stats}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="captura-stats__sync-status">
          <p>
            Last sync: {new Date(syncStatus.timestamp).toLocaleString()}
            {syncStatus.status === 'completed' && (
              <span className="status-success"> ✓ Completed</span>
            )}
          </p>
        </div>
      )}

      {/* Period Selector */}
      <div className="captura-stats__controls">
        <div className="captura-stats__period-selector">
          <button 
            className={selectedPeriod === 'day' ? 'active' : ''}
            onClick={() => setSelectedPeriod('day')}
          >
            Day
          </button>
          <button 
            className={selectedPeriod === 'week' ? 'active' : ''}
            onClick={() => setSelectedPeriod('week')}
          >
            Week
          </button>
          <button 
            className={selectedPeriod === 'month' ? 'active' : ''}
            onClick={() => setSelectedPeriod('month')}
          >
            Month
          </button>
          <button 
            className={selectedPeriod === 'quarter' ? 'active' : ''}
            onClick={() => setSelectedPeriod('quarter')}
          >
            Quarter
          </button>
          <button 
            className={selectedPeriod === 'year' ? 'active' : ''}
            onClick={() => setSelectedPeriod('year')}
          >
            Year
          </button>
        </div>
        
        <div className="captura-stats__date-selector">
          <input 
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
          />
        </div>
      </div>

      {/* Stats Display */}
      {stats ? (
        <>
          {/* Key Metrics */}
          <div className="captura-stats__metrics">
            <div className="metric-card">
              <div className="metric-icon">
                <Package />
              </div>
              <div className="metric-content">
                <h3>Total Orders</h3>
                <p className="metric-value">{formatNumber(stats.totalOrders)}</p>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">
                <DollarSign />
              </div>
              <div className="metric-content">
                <h3>Total Revenue</h3>
                <p className="metric-value">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">
                <TrendingUp />
              </div>
              <div className="metric-content">
                <h3>Average Order</h3>
                <p className="metric-value">{formatCurrency(stats.averageOrderValue)}</p>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon">
                <Users />
              </div>
              <div className="metric-content">
                <h3>Total Items</h3>
                <p className="metric-value">{formatNumber(stats.totalItems)}</p>
              </div>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="captura-stats__details">
            {/* Top Galleries */}
            <div className="stats-section">
              <div 
                className="section-header"
                onClick={() => setExpandedSection(
                  expandedSection === 'galleries' ? null : 'galleries'
                )}
              >
                <h2>Top Galleries</h2>
                <ChevronRight 
                  className={expandedSection === 'galleries' ? 'rotated' : ''} 
                />
              </div>
              
              {(expandedSection === 'galleries' || selectedPeriod === 'day') && (
                <div className="section-content">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Gallery</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.ordersByGallery || {})
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .slice(0, 10)
                        .map(([gallery, data]) => (
                          <tr key={gallery}>
                            <td>{gallery}</td>
                            <td>{formatNumber(data.count || data.orders)}</td>
                            <td>{formatCurrency(data.revenue)}</td>
                            <td>
                              {((data.revenue / stats.totalRevenue) * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Schools */}
            <div className="stats-section">
              <div 
                className="section-header"
                onClick={() => setExpandedSection(
                  expandedSection === 'schools' ? null : 'schools'
                )}
              >
                <h2>Top Schools</h2>
                <ChevronRight 
                  className={expandedSection === 'schools' ? 'rotated' : ''} 
                />
              </div>
              
              {(expandedSection === 'schools' || selectedPeriod === 'day') && (
                <div className="section-content">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>School</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>Top Gallery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.ordersBySchool || {})
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .slice(0, 10)
                        .map(([school, data]) => (
                          <tr key={school}>
                            <td>{school}</td>
                            <td>{formatNumber(data.count || data.orders)}</td>
                            <td>{formatCurrency(data.revenue)}</td>
                            <td>{data.topGallery || '-'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="stats-section">
              <div 
                className="section-header"
                onClick={() => setExpandedSection(
                  expandedSection === 'products' ? null : 'products'
                )}
              >
                <h2>Top Products</h2>
                <ChevronRight 
                  className={expandedSection === 'products' ? 'rotated' : ''} 
                />
              </div>
              
              {(expandedSection === 'products' || selectedPeriod === 'day') && (
                <div className="section-content">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.topProducts || []).map((product, index) => (
                        <tr key={product.sku || index}>
                          <td>{product.name}</td>
                          <td>{product.sku || '-'}</td>
                          <td>{formatNumber(product.quantity)}</td>
                          <td>{formatCurrency(product.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Charts would go here */}
            {/* Implement with Chart.js or similar library */}
          </div>
        </>
      ) : (
        <div className="captura-stats__no-data">
          <p>No data available for the selected period.</p>
        </div>
      )}
    </div>
  );
};

export default CapturaStats;
```

### 3. Stats Page Styles

```css
/* src/pages/CapturaStats.css */
.captura-stats {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.captura-stats__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.captura-stats__header h1 {
  font-size: 2rem;
  color: var(--text-primary);
  margin: 0;
}

.captura-stats__actions {
  display: flex;
  gap: 1rem;
}

.captura-stats__refresh-btn,
.captura-stats__export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.captura-stats__refresh-btn:hover,
.captura-stats__export-btn:hover {
  background: var(--bg-hover);
}

.captura-stats__refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.captura-stats__sync-status {
  background: var(--bg-secondary);
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.status-success {
  color: var(--success-color);
  font-weight: 500;
}

.captura-stats__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.captura-stats__period-selector {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  padding: 0.25rem;
}

.captura-stats__period-selector button {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.captura-stats__period-selector button:hover {
  color: var(--text-primary);
}

.captura-stats__period-selector button.active {
  background: white;
  color: var(--primary-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.captura-stats__date-selector input {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 1rem;
}

/* Metrics Grid */
.captura-stats__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}

.metric-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-color-light);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
}

.metric-content h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem 0;
  font-weight: 500;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* Details Sections */
.captura-stats__details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-section {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  overflow: hidden;
}

.section-header {
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.section-header h2 {
  font-size: 1.125rem;
  margin: 0;
  color: var(--text-primary);
}

.section-header svg {
  transition: transform 0.2s;
  color: var(--text-secondary);
}

.section-header svg.rotated {
  transform: rotate(90deg);
}

.section-content {
  padding: 1.5rem;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
}

.stats-table th {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 2px solid var(--border-color);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-transform: uppercase;
}

.stats-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.stats-table tbody tr:hover {
  background: var(--bg-hover);
}

.stats-table tbody tr:last-child td {
  border-bottom: none;
}

/* Loading State */
.captura-stats__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: var(--text-secondary);
}

.captura-stats__spinner {
  animation: spin 1s linear infinite;
  width: 32px;
  height: 32px;
  margin-bottom: 1rem;
}

/* No Data State */
.captura-stats__no-data {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .captura-stats {
    padding: 1rem;
  }
  
  .captura-stats__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .captura-stats__controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .captura-stats__period-selector {
    width: 100%;
    justify-content: space-between;
  }
  
  .captura-stats__period-selector button {
    flex: 1;
    font-size: 0.875rem;
    padding: 0.5rem;
  }
  
  .stats-table {
    font-size: 0.875rem;
  }
  
  .stats-table th,
  .stats-table td {
    padding: 0.5rem;
  }
}
```

---

## Performance Optimization

### 1. Firestore Indexes

Add these indexes to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "batches",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "dateRange.start", "order": "ASCENDING" },
        { "fieldPath": "dateRange.end", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "logs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "startTime", "order": "DESCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 2. Security Rules

Update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Captura order batches - read only for authenticated users
    match /capturaOrderBatches/{date} {
      allow read: if request.auth != null;
      allow write: if false; // Only cloud functions can write
      
      match /{subcollection}/{document} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }
    
    // Captura order stats - read only for authenticated users
    match /capturaOrderStats/{type}/{year}/{document} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    // Sync status - read only for authenticated users, write for admins
    match /capturaOrderSyncStatus/{document} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
      
      match /{subcollection}/{doc} {
        allow read: if request.auth != null;
        allow write: if false;
      }
    }
  }
}
```

---

## Deployment Guide

### 1. Deploy Cloud Functions

```bash
# Install dependencies
cd functions
npm install

# Deploy functions
firebase deploy --only functions:syncDailyOrders,functions:backfillHistoricalData

# Set up scheduled function
firebase functions:config:set captura.account_id="YOUR_ACCOUNT_ID"
```

### 2. Initial Data Backfill

```javascript
// Run in Firebase Console or admin script
const backfillYear = async () => {
  const functions = getFunctions();
  const backfill = httpsCallable(functions, 'backfillHistoricalData');
  
  // Backfill in monthly chunks
  const months = [
    { start: '2025-01-01', end: '2025-01-31' },
    { start: '2025-02-01', end: '2025-02-28' },
    // ... etc
  ];
  
  for (const month of months) {
    console.log(`Backfilling ${month.start} to ${month.end}`);
    const result = await backfill(month);
    console.log('Result:', result.data);
    
    // Wait between months to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 60000));
  }
};
```

### 3. Monitor Functions

```bash
# View logs
firebase functions:log --only syncDailyOrders

# Check function metrics
firebase functions:list
```

---

## Maintenance and Monitoring

### 1. Daily Monitoring Checklist

- Check sync status in Firestore Console
- Verify daily summaries are being created
- Monitor function execution logs
- Check error rates in Cloud Functions dashboard

### 2. Monthly Tasks

- Review and optimize slow queries
- Check storage usage and costs
- Update monthly/yearly aggregates if needed
- Clean up old sync logs

### 3. Troubleshooting Common Issues

**Sync Failures:**
```javascript
// Check last sync status
const status = await db.collection('capturaOrderSyncStatus')
  .doc('lastSync')
  .get();
console.log('Last sync:', status.data());

// Check sync logs
const logs = await db.collection('capturaOrderSyncStatus')
  .doc('syncHistory')
  .collection('logs')
  .orderBy('startTime', 'desc')
  .limit(10)
  .get();
```

**Missing Data:**
```javascript
// Manually trigger backfill for specific date
const backfill = httpsCallable(functions, 'backfillHistoricalData');
await backfill({ startDate: '2025-01-15', endDate: '2025-01-15' });
```

**Performance Issues:**
- Check if indexes are properly created
- Monitor cache hit rates
- Consider increasing batch sizes
- Add more RAM to Cloud Functions if needed

---

## Summary

This system provides:

1. **Automated daily syncing** of Captura orders
2. **Efficient batched storage** minimizing Firestore reads
3. **Pre-calculated statistics** for instant access
4. **Scalable architecture** that handles API limits
5. **Cost-effective solution** with minimal ongoing reads

Key benefits:
- Daily stats: 1 read vs 1000+ reads
- Monthly stats: 1 read vs 30,000+ reads  
- Yearly stats: 1 read vs 365,000+ reads
- Full order details available when needed
- Automatic handling of the 5000-order API limit

The system is designed to be maintainable, scalable, and cost-effective while providing comprehensive analytics for your Captura orders.