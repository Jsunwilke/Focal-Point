// functions/capturaStats.js
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();
const BATCH_SIZE = 500;
const API_LIMIT = 5000;

/**
 * Get Captura access token
 */
async function getCapturaAccessToken() {
  try {
    const clientId = process.env.CAPTURA_CLIENT_ID || '1ab255f1-5a89-4ae8-b454-4da98b64afcb';
    const clientSecret = process.env.CAPTURA_CLIENT_SECRET || '18458cffbe1e0fe82b2c99d4ead741cc8271640b0020d8f61035945be374675913a32303e32ce6c6a78d88c91554419e19cd458ce28d490302d2c1dd020df03d';
    
    const response = await axios.post('https://api.imagequix.com/api/oauth/token', 
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    logger.error('Failed to get Captura access token:', error);
    throw new Error('Failed to authenticate with Captura API');
  }
}

/**
 * Scheduled function to sync daily orders
 * Runs every day at 2 AM
 */
exports.syncDailyOrders = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'America/Chicago',
  memory: '512MB',
  timeoutSeconds: 540
}, async (event) => {
    const syncStart = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    
    try {
      logger.info(`Starting daily sync for ${dateStr}`);
      
      // Step 1: Fetch all order IDs for the date
      const orderList = await fetchAllOrdersForDate(dateStr);
      logger.info(`Found ${orderList.length} orders for ${dateStr}`);
      
      // Step 2: Fetch detailed data for each order
      const detailedOrders = await fetchOrderDetails(orderList);
      
      // Step 3: Batch and store orders
      const batchIds = await batchAndStoreOrders(dateStr, detailedOrders);
      
      // Step 4: Calculate and store daily summary
      const summary = calculateDailySummary(dateStr, detailedOrders);
      summary.batchIds = batchIds;
      await storeDailySummary(dateStr, summary);
      
      // Step 5: Update monthly stats
      await updateMonthlyStats(yesterday);
      
      // Step 6: Log success
      await logSyncStatus(syncStart, 'completed', orderList.length);
      
      return { success: true, ordersProcessed: orderList.length };
      
    } catch (error) {
      logger.error('Sync failed:', error);
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
  
  logger.info(`Starting to fetch orders for date: ${dateStr}`);
  
  while (hasMore) {
    const batch = await fetchOrderBatch(dateStr, dateStr, start, start + API_LIMIT - 1);
    
    if (batch && Array.isArray(batch)) {
      logger.info(`Received batch with ${batch.length} items`);
      
      // Extract orders from each batch item
      let ordersInThisBatch = 0;
      batch.forEach((batchItem, index) => {
        if (batchItem.orders && Array.isArray(batchItem.orders)) {
          logger.info(`Batch item ${index} has ${batchItem.orders.length} orders`);
          allOrders.push(...batchItem.orders);
          ordersInThisBatch += batchItem.orders.length;
        } else {
          logger.info(`Batch item ${index} has no orders array`);
        }
      });
      
      logger.info(`Extracted ${ordersInThisBatch} orders from this batch. Total so far: ${allOrders.length}`);
      
      // Check if we got less than the limit
      const batchOrderCount = batch.reduce((sum, item) => 
        sum + (item.orders ? item.orders.length : 0), 0);
      
      if (batchOrderCount < API_LIMIT) {
        hasMore = false;
      } else {
        start += API_LIMIT;
        // Add delay to respect rate limits
        await sleep(1000);
      }
    } else {
      logger.info('Batch is null or not an array - stopping');
      hasMore = false;
    }
  }
  
  logger.info(`Finished fetching orders for ${dateStr}. Total orders found: ${allOrders.length}`);
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
  
  logger.info(`Fetching orders: ${url}`);
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000 // 30 second timeout
  });
  
  // Log the full response structure
  logger.info(`API Response - Total: ${response.data.total}, Start: ${response.data.start}, End: ${response.data.end}`);
  logger.info(`API Response - Data array length: ${response.data.data ? response.data.data.length : 0}`);
  
  // Log first item if exists to see structure
  if (response.data.data && response.data.data.length > 0) {
    const firstItem = response.data.data[0];
    logger.info(`First batch item has ${firstItem.orders ? firstItem.orders.length : 0} orders`);
  }
  
  return response.data.data;
}

/**
 * Fetch detailed order information for each order
 */
async function fetchOrderDetails(orderList) {
  const detailedOrders = [];
  const batchSize = 10; // Process 10 orders at a time to avoid timeout
  
  for (let i = 0; i < orderList.length; i += batchSize) {
    const batch = orderList.slice(i, i + batchSize);
    const promises = batch.map(order => fetchSingleOrderDetail(order.id || order.orderID));
    
    try {
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          detailedOrders.push(result.value);
        } else {
          logger.error(`Failed to fetch order ${batch[index].id}:`, result.reason);
        }
      });
      
      // Rate limiting
      if (i + batchSize < orderList.length) {
        await sleep(500);
      }
    } catch (error) {
      logger.error(`Batch ${i} failed:`, error);
    }
  }
  
  return detailedOrders;
}

/**
 * Fetch single order detail
 */
async function fetchSingleOrderDetail(orderId) {
  if (!orderId) {
    throw new Error('Order ID is required');
  }
  
  try {
    const accessToken = await getCapturaAccessToken();
    const accountId = process.env.CAPTURA_ACCOUNT_ID || 'J98TA9W';
    const url = `https://api.imagequix.com/api/v1/account/${accountId}/order/${orderId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    return response.data;
  } catch (error) {
    logger.error(`Failed to fetch order ${orderId}:`, error.message);
    throw error;
  }
}

/**
 * Batch orders and store in Firestore
 */
async function batchAndStoreOrders(dateStr, orders) {
  const validOrders = orders.filter(o => o !== null);
  const batches = [];
  
  // Sort orders by timestamp for consistent batching
  validOrders.sort((a, b) => {
    const timeA = new Date(a.orderDate + ' ' + (a.orderTime || '00:00:00'));
    const timeB = new Date(b.orderDate + ' ' + (b.orderTime || '00:00:00'));
    return timeA - timeB;
  });
  
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
        start: batch[0].orderDate + 'T' + (batch[0].orderTime || '00:00:00'),
        end: batch[batch.length - 1].orderDate + 'T' + (batch[batch.length - 1].orderTime || '23:59:59')
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
  
  logger.info(`Stored ${batches.length} batches for ${dateStr}`);
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
    if (order.orderTime) {
      const hour = order.orderTime.split(':')[0];
      if (summary.ordersByHour[hour]) {
        summary.ordersByHour[hour].count++;
        summary.ordersByHour[hour].revenue += order.total || 0;
      }
    }
    
    // Customer tracking
    const customerId = order.customerEmail || order.customerId || order.billTo?.email;
    if (customerId) {
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, { orders: 0, revenue: 0 });
      }
      const customer = customerMap.get(customerId);
      customer.orders++;
      customer.revenue += order.total || 0;
    }
    
    // Gallery breakdown
    if (order.galleryOrders && Array.isArray(order.galleryOrders)) {
      order.galleryOrders.forEach(go => {
        const galleryName = go.gallery?.title || go.gallery?.name || go.galleryName || 'Unknown';
        if (!galleryMap.has(galleryName)) {
          galleryMap.set(galleryName, {
            count: 0,
            revenue: 0,
            items: 0
          });
        }
        const gallery = galleryMap.get(galleryName);
        gallery.count++;
        gallery.revenue += go.total || go.subtotal || 0;
        gallery.items += go.items?.length || 0;
      });
    }
    
    // School breakdown
    const schoolName = order.school || order.schoolName || 
                      order.galleryOrders?.[0]?.school || 
                      order.galleryOrders?.[0]?.schoolName || 'Unknown';
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
    if (order.galleryOrders) {
      order.galleryOrders.forEach(go => {
        const galleryName = go.gallery?.title || go.gallery?.name || go.galleryName;
        if (galleryName) school.galleries.add(galleryName);
      });
    }
    
    // Payment status
    const paymentStatus = order.paymentStatus || 'unknown';
    if (!paymentMap.has(paymentStatus)) {
      paymentMap.set(paymentStatus, { count: 0, amount: 0 });
    }
    const payment = paymentMap.get(paymentStatus);
    payment.count++;
    payment.amount += order.total || 0;
    
    // Product tracking
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        const productKey = item.sku || item.productId || item.catalogProduct?.sku || item.name;
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            name: item.name || item.catalogProduct?.name || item.description,
            sku: item.sku || item.catalogProduct?.sku,
            quantity: 0,
            revenue: 0
          });
        }
        const product = productMap.get(productKey);
        product.quantity += item.quantity || 1;
        product.revenue += (item.quantity || 1) * (item.price || item.unitPrice || 0);
      });
    }
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
  
  logger.info(`Stored daily summary for ${dateStr}`);
}

/**
 * Update monthly statistics
 */
async function updateMonthlyStats(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
  
  logger.info(`Updating monthly stats for ${monthStr}`);
  
  // Get all daily summaries for the month
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const dailySummaries = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    try {
      const summaryDoc = await db.collection('capturaOrderBatches')
        .doc(dateStr)
        .collection('summary')
        .doc('daily')
        .get();
      
      if (summaryDoc.exists) {
        dailySummaries.push(summaryDoc.data());
      }
    } catch (error) {
      logger.warn(`No summary for ${dateStr}`);
    }
  }
  
  if (dailySummaries.length === 0) {
    logger.warn(`No daily summaries found for ${monthStr}`);
    return;
  }
  
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
    monthlyStats.totalOrders += day.totalOrders || 0;
    monthlyStats.totalRevenue += day.totalRevenue || 0;
    monthlyStats.totalItems += day.totalItems || 0;
    
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
      total.orders += data.count || 0;
      total.revenue += data.revenue || 0;
    });
    
    // Aggregate schools
    Object.entries(day.ordersBySchool || {}).forEach(([name, data]) => {
      if (!schoolTotals.has(name)) {
        schoolTotals.set(name, { orders: 0, revenue: 0 });
      }
      const total = schoolTotals.get(name);
      total.orders += data.count || 0;
      total.revenue += data.revenue || 0;
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
      total.quantity += product.quantity || 0;
      total.revenue += product.revenue || 0;
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
    week.orders += day.totalOrders || 0;
    week.revenue += day.totalRevenue || 0;
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
  
  // Store monthly stats
  await db.collection('capturaOrderStats')
    .doc('monthly')
    .collection(year.toString())
    .doc(monthStr)
    .set(monthlyStats);
  
  logger.info(`Stored monthly stats for ${monthStr}`);
}

/**
 * Manual backfill function - callable
 */
exports.backfillHistoricalData = onCall({
  memory: '1GB',
  timeoutSeconds: 540,
  cors: true
}, async (request) => {
  // Verify admin
  if (!request.auth) {
    throw new Error('Authentication required');
  }
  
  const data = request.data;
  
  const { startDate, endDate } = data;
  if (!startDate || !endDate) {
    throw new Error('Start and end dates required');
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = [];
  
  logger.info(`Starting backfill from ${startDate} to ${endDate}`);
  
  // Process each day
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    
    try {
      logger.info(`Backfilling ${dateStr}`);
      
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
      logger.info(`Backfill for ${dateStr}: Found ${orderList.length} orders from batch API`);
      
      if (orderList.length === 0) {
        logger.info(`No orders found for ${dateStr}, skipping detailed fetch`);
        results.push({ 
          date: dateStr, 
          status: 'completed', 
          orders: 0 
        });
        continue;
      }
      
      const detailedOrders = await fetchOrderDetails(orderList);
      logger.info(`Fetched ${detailedOrders.length} detailed orders out of ${orderList.length}`);
      
      const batchIds = await batchAndStoreOrders(dateStr, detailedOrders);
      const summary = calculateDailySummary(dateStr, detailedOrders);
      summary.batchIds = batchIds;
      await storeDailySummary(dateStr, summary);
      
      results.push({ 
        date: dateStr, 
        status: 'completed', 
        orders: orderList.length 
      });
      
      // Rate limiting between days
      await sleep(2000);
      
    } catch (error) {
      logger.error(`Failed to backfill ${dateStr}:`, error);
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