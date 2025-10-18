// Orders Context
// Manages orders state for Captura integration

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { capturaOrdersService } from '../services/capturaOrdersService';
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

  // Load orders directly from API
  const loadOrders = useCallback(async (page = 1, currentFilters = filters) => {
    if (!accountId) {
      setError('Captura account not configured');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Fetch data from API
      const data = await capturaOrdersService.getOrders({
        start: (page - 1) * pagination.pageSize + 1,
        end: page * pagination.pageSize,
        orderStartDate: currentFilters.startDate,
        orderEndDate: currentFilters.endDate,
        paymentStatus: currentFilters.status,
        orderType: currentFilters.orderType
      });

      // Update state with data
      setOrders(data.orders || []);
      setPagination(data.pagination || pagination);
      setOriginalApiResponse(data.originalApiResponse || null);

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
      // Check if we have this order in the current list and display it immediately
      const orderInList = orders.find(o => o.id === orderId);
      if (orderInList) {
        setSelectedOrder(orderInList);
      }

      // Fetch detailed data from API
      const order = await capturaOrdersService.getOrderById(orderId);
      setSelectedOrder(order);
    } catch (err) {
      console.error('Error loading order details:', err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoadingOrderDetails(false);
    }
  }, [accountId, orders]);

  // Load statistics - DISABLED: Captura API doesn't have a statistics endpoint
  const loadStatistics = useCallback(async (range = 'month') => {
    // Statistics endpoint doesn't exist in Captura API
    // TODO: Implement by fetching orders and calculating stats locally
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

  // Refresh orders
  const refreshOrders = useCallback(async () => {
    setRefreshing(true);

    // Reload orders
    await loadOrders(pagination.currentPage, filters);

    // Skip statistics - endpoint doesn't exist
    // await loadStatistics('month');

    setRefreshing(false);
  }, [loadOrders, loadStatistics, pagination.currentPage, filters]);

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