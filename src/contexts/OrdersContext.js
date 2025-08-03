// Orders Context
// Manages orders state with cache-first loading pattern

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { capturaOrdersService } from '../services/capturaOrdersService';
import { ordersCacheService } from '../services/ordersCacheService';
import { readCounter } from '../services/readCounter';

const OrdersContext = createContext({});

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within OrdersProvider');
  }
  return context;
};

export const OrdersProvider = ({ children }) => {
  const { organization } = useAuth();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [error, setError] = useState(null);
  const [originalApiResponse, setOriginalApiResponse] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 500, // Increased to handle more orders per day
    totalPages: 1,
    totalCount: 0
  });
  const [filters, setFilters] = useState({
    status: null,
    orderType: null,
    startDate: null,
    endDate: null,
    searchTerm: null,
    sortBy: 'orderDate',
    sortOrder: 'desc'
  });
  const [statistics, setStatistics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get account ID from environment or organization
  const accountId = process.env.REACT_APP_CAPTURA_ACCOUNT_ID || organization?.capturaAccountId;

  // Load orders with cache-first pattern
  const loadOrders = useCallback(async (page = 1, currentFilters = filters) => {
    if (!accountId) {
      setError('Captura account not configured');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Load from cache first for instant display
      const cachedData = ordersCacheService.getCachedOrders(accountId, {
        ...currentFilters,
        page,
        pageSize: pagination.pageSize
      });

      if (cachedData) {
        setOrders(cachedData.orders || []);
        setPagination(cachedData.pagination || pagination);
        setOriginalApiResponse(cachedData.originalApiResponse || null);
        setLoading(false);
      } else {
        // Record cache miss
        readCounter.recordCacheMiss('orders', 'OrdersContext');
      }

      // Fetch fresh data in background with filters
      const freshData = await capturaOrdersService.getOrders({
        start: (page - 1) * pagination.pageSize + 1,
        end: page * pagination.pageSize,
        orderStartDate: currentFilters.startDate,
        orderEndDate: currentFilters.endDate,
        paymentStatus: currentFilters.status,
        orderType: currentFilters.orderType
      });

      // Update state with fresh data
      setOrders(freshData.orders || []);
      setPagination(freshData.pagination || pagination);
      setOriginalApiResponse(freshData.originalApiResponse || null);
      
      // Cache the fresh data
      ordersCacheService.setCachedOrders(accountId, {
        ...currentFilters,
        page,
        pageSize: pagination.pageSize
      }, freshData);

      setLoading(false);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
      setLoading(false);
    }
  }, [accountId, filters, pagination.pageSize]);

  // Load order details
  const loadOrderDetails = useCallback(async (orderId) => {
    if (!accountId || !orderId) return;

    setLoadingOrderDetails(true);
    try {
      // First check if we have this order in the current list and display it immediately
      const orderInList = orders.find(o => o.id === orderId);
      if (orderInList) {
        console.log('Displaying order from list immediately:', orderInList);
        setSelectedOrder(orderInList);
        // Don't return - continue to fetch detailed data
      }
      
      // Check cache for detailed order
      const cachedDetailedOrder = ordersCacheService.getCachedOrder(accountId, orderId);
      
      if (cachedDetailedOrder && cachedDetailedOrder.items) {
        // We have a detailed order with items - use it
        console.log('Using cached detailed order:', cachedDetailedOrder);
        setSelectedOrder(cachedDetailedOrder);
        readCounter.recordCacheHit('order-detail', 'OrdersContext', 1);
        setLoadingOrderDetails(false);
        return; // No need to fetch again
      } else if (!orderInList && cachedDetailedOrder) {
        // Show cached version if we don't have list version
        console.log('Using cached order (no items):', cachedDetailedOrder);
        setSelectedOrder(cachedDetailedOrder);
      } else {
        readCounter.recordCacheMiss('order-detail', 'OrdersContext');
      }

      // Always fetch fresh detailed data to get items and full information
      console.log('Fetching detailed order data for:', orderId);
      const freshOrder = await capturaOrdersService.getOrderById(orderId);
      console.log('Fresh detailed order received:', freshOrder);
      console.log('=== Order Details Debug ===');
      console.log('Gallery Orders in fresh order:', freshOrder?.galleryOrders);
      console.log('Items by Student:', freshOrder?.itemsByStudent);
      if (freshOrder?.galleryOrders) {
        freshOrder.galleryOrders.forEach((go, idx) => {
          console.log(`Gallery Order ${idx} gallery data:`, {
            hasGallery: !!go.gallery,
            galleryTitle: go.gallery?.title,
            galleryName: go.gallery?.name,
            fullGalleryObject: go.gallery
          });
        });
      }
      setSelectedOrder(freshOrder);
      
      // Cache the order
      ordersCacheService.setCachedOrder(accountId, orderId, freshOrder);
      
      // Update in list cache if present
      ordersCacheService.updateCachedOrder(accountId, filters, freshOrder);
    } catch (err) {
      console.error('Error loading order details:', err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoadingOrderDetails(false);
    }
  }, [accountId, filters, orders]);

  // Load statistics - DISABLED: Captura API doesn't have a statistics endpoint
  const loadStatistics = useCallback(async (range = 'month') => {
    // Statistics endpoint doesn't exist in Captura API
    // TODO: Implement by fetching orders and calculating stats locally
    console.log('Statistics loading disabled - endpoint not available');
    return;
    
    /* Original implementation commented out:
    if (!accountId) return;

    try {
      // Check cache first
      const cachedStats = ordersCacheService.getCachedStatistics(accountId, range);
      
      if (cachedStats) {
        setStatistics(cachedStats);
      } else {
        readCounter.recordCacheMiss('order-stats', 'OrdersContext');
      }

      // Fetch fresh data
      const freshStats = await capturaOrdersService.getOrderStatistics(range);
      setStatistics(freshStats);
      
      // Cache the statistics
      ordersCacheService.setCachedStatistics(accountId, range, freshStats);
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
    */
  }, [accountId]);

  // Search orders
  const searchOrders = useCallback(async (searchTerm) => {
    const newFilters = { ...filters, searchTerm };
    setFilters(newFilters);
    await loadOrders(1, newFilters);
  }, [filters, loadOrders]);

  // Filter orders by payment status
  const filterByStatus = useCallback(async (status) => {
    const newFilters = { ...filters, status };
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    await loadOrders(1, newFilters);
  }, [filters, loadOrders]);

  // Filter orders by order type
  const filterByOrderType = useCallback(async (orderType) => {
    const newFilters = { ...filters, orderType };
    setFilters(newFilters);
    await loadOrders(1, newFilters);
  }, [filters, loadOrders]);

  // Filter orders by date range
  const filterByDateRange = useCallback(async (startDate, endDate) => {
    const newFilters = { ...filters, startDate, endDate };
    setFilters(newFilters);
    await loadOrders(1, newFilters);
  }, [filters, loadOrders]);

  // Sort orders
  const sortOrders = useCallback(async (sortBy, sortOrder = 'asc') => {
    const newFilters = { ...filters, sortBy, sortOrder };
    setFilters(newFilters);
    await loadOrders(pagination.currentPage, newFilters);
  }, [filters, loadOrders, pagination.currentPage]);

  // Refresh orders (bypass cache)
  const refreshOrders = useCallback(async () => {
    setRefreshing(true);
    
    // Clear cache for current filters
    ordersCacheService.clearCache(accountId);
    
    // Reload orders
    await loadOrders(pagination.currentPage, filters);
    
    // Skip statistics - endpoint doesn't exist
    // await loadStatistics('month');
    
    setRefreshing(false);
  }, [accountId, loadOrders, loadStatistics, pagination.currentPage, filters]);

  // Go to page
  const goToPage = useCallback(async (page) => {
    await loadOrders(page, filters);
  }, [loadOrders, filters]);

  // Clear filters
  const clearFilters = useCallback(async () => {
    const defaultFilters = {
      status: null,
      orderType: null,
      startDate: null,
      endDate: null,
      searchTerm: null,
      sortBy: 'orderDate',
      sortOrder: 'desc'
    };
    setFilters(defaultFilters);
    await loadOrders(1, defaultFilters);
  }, [loadOrders]);

  // Initial load
  useEffect(() => {
    if (accountId) {
      loadOrders(1);
      // Skip statistics - endpoint doesn't exist
      // loadStatistics('month');
    }
  }, [accountId]); // Only depend on accountId to avoid re-fetching

  // Clear cache on unmount (optional - remove if you want persistent cache)
  useEffect(() => {
    return () => {
      // Optionally clear cache on unmount
      // ordersCacheService.clearCache(accountId);
    };
  }, [accountId]);

  const value = {
    // State
    orders,
    selectedOrder,
    loading,
    loadingOrderDetails,
    error,
    pagination,
    filters,
    // statistics, // Removed - endpoint doesn't exist
    refreshing,
    originalApiResponse,
    
    // Actions
    loadOrders,
    loadOrderDetails,
    // loadStatistics, // Removed - endpoint doesn't exist
    searchOrders,
    filterByStatus,
    filterByOrderType,
    filterByDateRange,
    sortOrders,
    refreshOrders,
    goToPage,
    clearFilters,
    setSelectedOrder
  };

  return (
    <OrdersContext.Provider value={value}>
      {children}
    </OrdersContext.Provider>
  );
};