// Orders Page Component
// Displays Captura orders with search, filter, and pagination

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useOrders } from '../contexts/OrdersContext';
import { 
  Search, 
  RefreshCw, 
  Filter, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Package,
  DollarSign,
  Clock,
  Eye,
  X,
  User,
  MapPin,
  Mail,
  Phone,
  ShoppingCart,
  Image,
  Users,
  CreditCard,
  FileText,
  Copy,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import '../components/shared/Modal.css';
import './Orders.css';
import './Orders.modal.css';

const Orders = () => {
  const {
    orders,
    loading,
    loadingOrderDetails,
    error,
    pagination,
    filters,
    refreshing,
    originalApiResponse,
    searchOrders,
    filterByStatus,
    filterByDateRange,
    sortOrders,
    refreshOrders,
    goToPage,
    clearFilters,
    loadOrderDetails,
    selectedOrder,
    setSelectedOrder
  } = useOrders();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showRawJson, setShowRawJson] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState(null);

  // Order status options
  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Filter orders client-side based on search term
  const filteredOrders = orders.filter(order => {
    if (!filters.searchTerm) return true;
    
    const searchLower = filters.searchTerm.toLowerCase();
    
    // Search in multiple fields
    return (
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerEmail?.toLowerCase().includes(searchLower) ||
      order.id?.toString().includes(searchLower) ||
      order.galleryName?.toLowerCase().includes(searchLower) ||
      order.studentNames?.toLowerCase().includes(searchLower)
    );
  });

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    searchOrders(searchTerm);
  };

  // Handle status filter
  const handleStatusFilter = (status) => {
    setSelectedStatus(status);
    filterByStatus(status || null);
  };

  // Handle date range filter
  const handleDateFilter = () => {
    if (dateRange.start && dateRange.end) {
      filterByDateRange(new Date(dateRange.start), new Date(dateRange.end));
    }
  };

  // Handle sort
  const handleSort = (field) => {
    const currentSortOrder = filters.sortBy === field && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    sortOrders(field, currentSortOrder);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setDateRange({ start: '', end: '' });
    clearFilters();
  };

  // View order details
  const handleViewOrder = (order) => {
    loadOrderDetails(order.id);
  };

  // Close order details modal
  const handleCloseDetails = () => {
    setSelectedOrder(null);
    setShowRawJson(false);
    setActiveTab('overview');
    setCopiedField(null);
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text, fieldName) => {
    try {
      // Try the modern clipboard API first
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      // Fallback for when clipboard API fails (e.g., document not focused)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr);
      } finally {
        textArea.remove();
      }
    }
  };

  // Get status badge class
  const getStatusClass = (status) => {
    const statusClasses = {
      pending: 'orders__status--pending',
      processing: 'orders__status--processing',
      completed: 'orders__status--completed',
      shipped: 'orders__status--shipped',
      cancelled: 'orders__status--cancelled'
    };
    return statusClasses[status] || 'orders__status--default';
  };

  if (loading && orders.length === 0) {
    return (
      <div className="orders__loading">
        <div className="orders__spinner"></div>
        <p>Loading orders...</p>
      </div>
    );
  }

  // Check for Firebase Functions not deployed error
  if (error && (error.includes('Failed to fetch') || error.includes('Function not found'))) {
    return (
      <div className="orders">
        <div className="orders__header">
          <h1 className="orders__title">Orders</h1>
        </div>
        <div className="orders__error" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>Firebase Functions Not Deployed</h3>
          <p>The Orders feature requires Firebase Functions to be deployed.</p>
          <p>To deploy the functions, run:</p>
          <pre style={{ 
            background: 'var(--bg-secondary)', 
            padding: '1rem', 
            borderRadius: 'var(--border-radius)',
            margin: '1rem auto',
            maxWidth: '600px'
          }}>
            firebase deploy --only functions
          </pre>
          <p style={{ marginTop: '1rem' }}>
            Or deploy specific Captura functions:
          </p>
          <pre style={{ 
            background: 'var(--bg-secondary)', 
            padding: '1rem', 
            borderRadius: 'var(--border-radius)',
            margin: '1rem auto',
            maxWidth: '600px'
          }}>
            firebase deploy --only functions:getCapturaOrders,functions:getCapturaOrder,functions:getCapturaOrderStats
          </pre>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            After deployment, refresh this page to load orders.
          </p>
        </div>
      </div>
    );
  }


  return (
    <>
      <div className="orders">
        <div className="orders__header">
        <h1 className="orders__title">Orders</h1>
        
        <div className="orders__actions">
          <button 
            className="orders__refresh-btn"
            onClick={refreshOrders}
            disabled={refreshing}
            title="Refresh orders"
          >
            <RefreshCw className={refreshing ? 'orders__refresh-icon--spinning' : ''} size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="orders__error">
          <p>{error}</p>
        </div>
      )}

      <div className="orders__controls">
        <form className="orders__search" onSubmit={handleSearch}>
          <input
            type="text"
            className="orders__search-input"
            placeholder="Search by order #, customer, email, gallery..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="orders__search-btn">
            <Search size={20} />
          </button>
        </form>

        <button 
          className="orders__filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} />
          Filters
          {(filters.status || filters.startDate || filters.endDate) && (
            <span className="orders__filter-badge">Active</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="orders__filters">
          <div className="orders__filter-group">
            <label>Status</label>
            <select 
              value={selectedStatus} 
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="orders__filter-select"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="orders__filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="orders__filter-input"
            />
          </div>

          <div className="orders__filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="orders__filter-input"
            />
          </div>

          <button 
            className="orders__filter-apply"
            onClick={handleDateFilter}
            disabled={!dateRange.start || !dateRange.end}
          >
            Apply Date Filter
          </button>

          <button 
            className="orders__filter-clear"
            onClick={handleClearFilters}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="orders__results-info">
        {filters.searchTerm && orders.length > 0 ? (
          <>Showing {filteredOrders.length} of {orders.length} orders</>
        ) : (
          <>Total orders: {orders.length}{pagination.totalCount > orders.length && ` (loaded ${orders.length} of ${pagination.totalCount})`}</>
        )}
      </div>
      
      <div className="orders__table-container">
        <table className="orders__table">
          <thead>
            <tr>
              <th onClick={() => handleSort('orderNumber')}>
                Order # {filters.sortBy === 'orderNumber' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('customerName')}>
                Customer {filters.sortBy === 'customerName' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Students</th>
              <th onClick={() => handleSort('orderDate')}>
                Date {filters.sortBy === 'orderDate' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Gallery</th>
              <th onClick={() => handleSort('paymentStatus')}>
                Payment {filters.sortBy === 'paymentStatus' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('total')}>
                Total {filters.sortBy === 'total' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="orders__empty">
                  <Package size={48} />
                  <p>No orders found</p>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="8" className="orders__empty">
                  <Search size={48} />
                  <p>No orders match your search criteria</p>
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id}>
                  <td className="orders__order-number">{order.orderNumber}</td>
                  <td>
                    <div className="orders__customer">
                      <div className="orders__customer-name">{order.customerName}</div>
                      {order.customerEmail && (
                        <div className="orders__customer-email">{order.customerEmail}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="orders__students">
                      {order.studentNames || 'N/A'}
                    </div>
                  </td>
                  <td>{formatDate(order.orderDate)}</td>
                  <td>
                    <div className="orders__gallery-name">
                      {order.galleryName || 'N/A'}
                    </div>
                  </td>
                  <td>
                    <span className={`orders__status ${getStatusClass(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="orders__total">
                    {formatCurrency(order.total)}
                    {order.discount > 0 && (
                      <div className="orders__discount">
                        -{formatCurrency(order.discount)}
                      </div>
                    )}
                  </td>
                  <td>
                    <button 
                      className="orders__view-btn"
                      onClick={() => handleViewOrder(order)}
                      title="View details"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="orders__pagination">
          <button
            className="orders__page-btn"
            onClick={() => goToPage(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="orders__page-info">
            Page {pagination.currentPage} of {pagination.totalPages} 
            ({pagination.totalCount} total orders)
          </span>
          
          <button
            className="orders__page-btn"
            onClick={() => goToPage(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      </div>
      
      {selectedOrder && ReactDOM.createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '2rem'
          }}
          onClick={handleCloseDetails}
        >
          <div 
            style={{
              position: 'relative',
              margin: 0,
              transform: 'none'
            }}
            className="modal modal--large" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <div className="modal__header-content">
                <h2 className="modal__title">Order Details</h2>
                <p className="modal__subtitle">{selectedOrder?.orderNumber || 'N/A'} - {selectedOrder?.customerName || 'Unknown Customer'}</p>
              </div>
              <button className="modal__close" onClick={handleCloseDetails}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal__tabs">
              <button 
                className={`modal__tab ${activeTab === 'overview' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Info size={18} />
                Overview
              </button>
              <button 
                className={`modal__tab ${activeTab === 'customer' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('customer')}
              >
                <User size={18} />
                Customer
              </button>
              <button 
                className={`modal__tab ${activeTab === 'items' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('items')}
              >
                <ShoppingCart size={18} />
                Items
              </button>
              <button 
                className={`modal__tab ${activeTab === 'gallery' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('gallery')}
              >
                <Users size={18} />
                Gallery
              </button>
              <button 
                className={`modal__tab ${activeTab === 'financial' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('financial')}
              >
                <CreditCard size={18} />
                Financial
              </button>
              <button 
                className={`modal__tab ${activeTab === 'advanced' ? 'modal__tab--active' : ''}`}
                onClick={() => setActiveTab('advanced')}
              >
                <FileText size={18} />
                Advanced
              </button>
            </div>
            
            <div className="modal__content" style={{ position: 'relative' }}>
              {/* Loading Overlay */}
              {loadingOrderDetails && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={32} className="animate-spin" style={{ marginBottom: '0.5rem' }} />
                    <p>Loading detailed order information...</p>
                  </div>
                </div>
              )}
              
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="orders__tab-content">
                  <div className="orders__overview-cards">
                    <div className="orders__overview-card">
                      <div className="orders__overview-icon">
                        <Package size={24} />
                      </div>
                      <div className="orders__overview-info">
                        <h4>Order Information</h4>
                        <p className="orders__overview-value">{selectedOrder?.orderNumber || 'N/A'}</p>
                        <p className="orders__overview-label">{formatDate(selectedOrder?.orderDate)}</p>
                      </div>
                    </div>
                    
                    <div className="orders__overview-card">
                      <div className="orders__overview-icon">
                        <CheckCircle size={24} />
                      </div>
                      <div className="orders__overview-info">
                        <h4>Order Status</h4>
                        <p className={`orders__status orders__status--large ${getStatusClass(selectedOrder?.status || 'pending')}`}>
                          {selectedOrder?.status || 'pending'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="orders__overview-card">
                      <div className="orders__overview-icon">
                        <CreditCard size={24} />
                      </div>
                      <div className="orders__overview-info">
                        <h4>Payment Status</h4>
                        <p className={`orders__status orders__status--large ${getStatusClass(selectedOrder?.paymentStatus || 'pending')}`}>
                          {selectedOrder?.paymentStatus || 'pending'}
                        </p>
                        <p className="orders__overview-label">{selectedOrder?.paymentType || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="orders__overview-card">
                      <div className="orders__overview-icon">
                        <DollarSign size={24} />
                      </div>
                      <div className="orders__overview-info">
                        <h4>Total Amount</h4>
                        <p className="orders__overview-value orders__overview-value--large">
                          {formatCurrency(selectedOrder?.total || 0)}
                        </p>
                        {selectedOrder?.discount > 0 && (
                          <p className="orders__overview-label orders__discount">
                            Discount: -{formatCurrency(selectedOrder.discount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="orders__detail-section">
                    <h3>Quick Summary</h3>
                    <div className="orders__detail-grid">
                      <div className="orders__detail-item">
                        <label>Customer:</label>
                        <span>{selectedOrder?.customerName || 'N/A'}</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Email:</label>
                        <span>{selectedOrder?.customerEmail || 'N/A'}</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Gallery:</label>
                        <span>{selectedOrder?.galleryName || 'N/A'}</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Students:</label>
                        <span>{selectedOrder?.studentNames || 'N/A'} ({selectedOrder?.galleryOrders?.length || 0})</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Items:</label>
                        <span>{selectedOrder?.items?.length || 0} items</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Currency:</label>
                        <span>{selectedOrder?.currency || 'USD'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Student Details Section for Multi-Student Orders */}
                  {selectedOrder?.itemsByStudent && selectedOrder.itemsByStudent.length > 0 && (
                    <div className="orders__detail-section">
                      <h3>Student Details</h3>
                      {selectedOrder.itemsByStudent.map((student, index) => (
                        <div key={student.galleryOrderID} className="orders__student-detail" style={{
                          marginBottom: index < selectedOrder.itemsByStudent.length - 1 ? '1.5rem' : 0,
                          paddingBottom: index < selectedOrder.itemsByStudent.length - 1 ? '1.5rem' : 0,
                          borderBottom: index < selectedOrder.itemsByStudent.length - 1 ? '1px solid var(--border-color)' : 'none'
                        }}>
                          <h4 style={{ marginBottom: '0.5rem' }}>
                            <User size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            {student.studentName}
                          </h4>
                          <div className="orders__detail-grid" style={{ marginBottom: '0.5rem' }}>
                            <div className="orders__detail-item">
                              <label>Grade:</label>
                              <span>{student.grade || 'N/A'}</span>
                            </div>
                            <div className="orders__detail-item">
                              <label>Teacher:</label>
                              <span>{student.teacher || 'N/A'}</span>
                            </div>
                            <div className="orders__detail-item">
                              <label>Items:</label>
                              <span>{student.items.length}</span>
                            </div>
                            <div className="orders__detail-item">
                              <label>Subtotal:</label>
                              <span>{formatCurrency(student.subtotal)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Tab */}
              {activeTab === 'customer' && (
                <div className="orders__tab-content">
                  <div className="orders__detail-section">
                    <h3><User size={20} className="orders__section-icon" /> Contact Information</h3>
                    <div className="orders__contact-card">
                      <div className="orders__contact-item">
                        <User size={18} />
                        <div>
                          <label>Full Name</label>
                          <p>{selectedOrder?.customerName || 'Not provided'}</p>
                        </div>
                      </div>
                      <div className="orders__contact-item">
                        <Mail size={18} />
                        <div>
                          <label>Email Address</label>
                          <p>
                            {selectedOrder?.customerEmail || 'Not provided'}
                            {selectedOrder?.customerEmail && (
                              <button 
                                className="orders__copy-btn"
                                onClick={() => copyToClipboard(selectedOrder.customerEmail, 'email')}
                                title="Copy email"
                              >
                                {copiedField === 'email' ? <CheckCircle size={14} /> : <Copy size={14} />}
                              </button>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="orders__contact-item">
                        <Phone size={18} />
                        <div>
                          <label>Phone Number</label>
                          <p>
                            {selectedOrder?.customerPhone || 'Not provided'}
                            {selectedOrder?.customerPhone && (
                              <button 
                                className="orders__copy-btn"
                                onClick={() => copyToClipboard(selectedOrder.customerPhone, 'phone')}
                                title="Copy phone"
                              >
                                {copiedField === 'phone' ? <CheckCircle size={14} /> : <Copy size={14} />}
                              </button>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="orders__addresses-grid">
                    {selectedOrder?.billTo && Object.keys(selectedOrder.billTo).length > 0 && (
                      <div className="orders__detail-section">
                        <h3><MapPin size={20} className="orders__section-icon" /> Billing Address</h3>
                        <div className="orders__address orders__address--detailed">
                          <p className="orders__address-name">
                            {selectedOrder.billTo?.firstName || ''} {selectedOrder.billTo?.lastName || ''}
                          </p>
                          {selectedOrder.billTo?.address && <p>{selectedOrder.billTo.address}</p>}
                          {selectedOrder.billTo?.address2 && <p>{selectedOrder.billTo.address2}</p>}
                          {(selectedOrder.billTo?.city || selectedOrder.billTo?.state || selectedOrder.billTo?.zipCode) && (
                            <p>
                              {selectedOrder.billTo?.city && `${selectedOrder.billTo.city}, `}
                              {selectedOrder.billTo?.state} {selectedOrder.billTo?.zipCode}
                            </p>
                          )}
                          {selectedOrder.billTo?.country && <p>{selectedOrder.billTo.country}</p>}
                          {selectedOrder.billTo?.email && (
                            <p className="orders__address-extra">
                              <Mail size={14} /> {selectedOrder.billTo.email}
                            </p>
                          )}
                          {selectedOrder.billTo?.phone && (
                            <p className="orders__address-extra">
                              <Phone size={14} /> {selectedOrder.billTo.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedOrder?.shipTo && Object.keys(selectedOrder.shipTo).length > 0 && (
                      <div className="orders__detail-section">
                        <h3><MapPin size={20} className="orders__section-icon" /> Shipping Address</h3>
                        <div className="orders__address orders__address--detailed">
                          <p className="orders__address-name">
                            {selectedOrder.shipTo?.firstName || ''} {selectedOrder.shipTo?.lastName || ''}
                          </p>
                          {selectedOrder.shipTo?.address && <p>{selectedOrder.shipTo.address}</p>}
                          {selectedOrder.shipTo?.address2 && <p>{selectedOrder.shipTo.address2}</p>}
                          {(selectedOrder.shipTo?.city || selectedOrder.shipTo?.state || selectedOrder.shipTo?.zipCode) && (
                            <p>
                              {selectedOrder.shipTo?.city && `${selectedOrder.shipTo.city}, `}
                              {selectedOrder.shipTo?.state} {selectedOrder.shipTo?.zipCode}
                            </p>
                          )}
                          {selectedOrder.shipTo?.country && <p>{selectedOrder.shipTo.country}</p>}
                          {selectedOrder.shipTo?.email && (
                            <p className="orders__address-extra">
                              <Mail size={14} /> {selectedOrder.shipTo.email}
                            </p>
                          )}
                          {selectedOrder.shipTo?.phone && (
                            <p className="orders__address-extra">
                              <Phone size={14} /> {selectedOrder.shipTo.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Tab */}
              {activeTab === 'items' && (
                <div className="orders__tab-content">
                  {selectedOrder?.galleryOrders && selectedOrder.galleryOrders.length > 1 ? (
                    <div className="orders__detail-section">
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>
                          <ShoppingCart size={20} className="orders__section-icon" /> 
                          Order Items ({selectedOrder?.items?.length || 0})
                        </h3>
                        {selectedOrder?.galleryName && (
                          <p style={{ 
                            margin: 0, 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.875rem',
                            paddingLeft: '1.75rem'
                          }}>
                            {selectedOrder.galleryName}
                          </p>
                        )}
                      </div>
                      
                      {/* Group items by student */}
                      {(() => {
                        // Use itemsByStudent if available, otherwise create grouping
                        let studentsWithItems = selectedOrder.itemsByStudent;
                        
                        // If itemsByStudent isn't available, create it from galleryOrders and items
                        if (!studentsWithItems || studentsWithItems.length === 0) {
                          const studentMap = {};
                          
                          // First, create student entries from galleryOrders
                          selectedOrder.galleryOrders.forEach(go => {
                            // Get student name - match the logic from transformOrder
                            let studentName = go.studentIdentifier;
                            if (!studentName && (go.subject?.firstName || go.subject?.lastName)) {
                              studentName = `${go.subject?.firstName || ''} ${go.subject?.lastName || ''}`.trim();
                            }
                            if (!studentName || studentName === '') {
                              studentName = 'Unknown Student';
                            }
                            
                            studentMap[go.id] = {
                              galleryOrderID: go.id,
                              studentName: studentName,
                              firstName: go.subject?.firstName || '',
                              lastName: go.subject?.lastName || '',
                              grade: go.subject?.grade || '',
                              teacher: go.subject?.teacher || '',
                              galleryName: go.gallery?.title || go.gallery?.name || '',
                              galleryID: go.galleryID,
                              items: [],
                              subtotal: 0
                            };
                          });
                          
                          // Then match items to students
                          const itemsSource = selectedOrder.fullApiResponse?.items || 
                                           selectedOrder.rawData?.items || 
                                           selectedOrder.items || [];
                          
                          itemsSource.forEach(item => {
                            const goid = item.galleryOrderID;
                            if (goid && studentMap[goid]) {
                              studentMap[goid].items.push({
                                id: item.id,
                                name: item.name || item.productName || 'Unknown Item',
                                type: item.type,
                                quantity: item.quantity || 1,
                                unitPrice: item.unitPrice || 0,
                                total: item.total || 0
                              });
                              studentMap[goid].subtotal += item.total || 0;
                            }
                          });
                          
                          studentsWithItems = Object.values(studentMap).filter(s => s.items.length > 0);
                        }
                        
                        return studentsWithItems.map((student, studentIndex, array) => {
                          return (
                        <div key={student.galleryOrderID} className="orders__student-items-section" style={{
                          marginBottom: studentIndex < array.length - 1 ? '2rem' : '1rem',
                          paddingBottom: studentIndex < array.length - 1 ? '2rem' : '0',
                          borderBottom: studentIndex < array.length - 1 ? '1px solid var(--border-color)' : 'none'
                        }}>
                          <div className="orders__student-header" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem',
                            padding: '1rem',
                            backgroundColor: '#f0f7ff',
                            borderRadius: '0.5rem',
                            border: '1px solid #d0e0f0'
                          }}>
                            <div>
                              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', fontSize: '1.1rem' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginRight: '0.75rem',
                                  fontSize: '0.875rem',
                                  fontWeight: 'bold'
                                }}>
                                  {studentIndex + 1}
                                </div>
                                {student.studentName}
                              </h4>
                              <p style={{ margin: '0.25rem 0 0 44px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Grade {student.grade} • {student.teacher}
                              </p>
                              {student.galleryName && (
                                <p style={{ margin: '0 0 0 44px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                  {student.galleryName}
                                </p>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#007bff' }}>
                                {formatCurrency(student.subtotal)}
                              </p>
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {student.items.length} item{student.items.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          
                          <div className="orders__items-enhanced">
                            {student.items.map((item, itemIndex) => (
                              <div key={item.id} className="orders__item-card" style={{ 
                                marginBottom: '0.75rem',
                                padding: '0.75rem',
                                backgroundColor: '#fff',
                                border: '1px solid #e0e0e0',
                                borderRadius: '0.25rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <div className="orders__item-details" style={{ flex: 1 }}>
                                  <h5 style={{ margin: 0, fontSize: '1rem' }}>{item.name}</h5>
                                  {item.type === 'package' && (
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      color: 'var(--text-secondary)',
                                      backgroundColor: '#f0f0f0',
                                      padding: '0.125rem 0.5rem',
                                      borderRadius: '0.25rem',
                                      display: 'inline-block',
                                      marginTop: '0.25rem'
                                    }}>
                                      Package
                                    </span>
                                  )}
                                </div>
                                <div className="orders__item-pricing" style={{ 
                                  display: 'flex', 
                                  gap: '2rem',
                                  alignItems: 'center'
                                }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Qty</p>
                                    <p style={{ margin: 0, fontWeight: '500' }}>{item.quantity}</p>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Price</p>
                                    <p style={{ margin: 0, fontWeight: '500' }}>{formatCurrency(item.unitPrice)}</p>
                                  </div>
                                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total</p>
                                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>{formatCurrency(item.total)}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Student Order Total */}
                          <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span>Items Subtotal:</span>
                              <span>{formatCurrency(student.subtotal)}</span>
                            </div>
                            {selectedOrder && selectedOrder.galleryOrders && (() => {
                              // Calculate the total of all student subtotals for accurate proportions
                              const allStudentsSubtotal = studentsWithItems.reduce((sum, s) => sum + s.subtotal, 0);
                              
                              // Calculate proportional amounts
                              const studentProportion = student.subtotal / allStudentsSubtotal;
                              const studentDiscountPortion = (selectedOrder.discount || 0) * studentProportion;
                              const studentTaxPortion = (selectedOrder.tax || 0) * studentProportion;
                              const studentShippingPortion = (selectedOrder.shipping || 0) / selectedOrder.galleryOrders.length;
                              
                              
                              // Calculate net subtotal after discount
                              const netSubtotal = student.subtotal + studentDiscountPortion; // discount is negative
                              
                              return (
                                <>
                                  {studentDiscountPortion !== 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                      <span>Discount (proportional):</span>
                                      <span style={{ color: studentDiscountPortion < 0 ? '#dc3545' : 'inherit' }}>
                                        {studentDiscountPortion < 0 ? '-' : ''}{formatCurrency(Math.abs(studentDiscountPortion))}
                                      </span>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span>Tax (proportional):</span>
                                    <span>{formatCurrency(studentTaxPortion)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span>Shipping (split):</span>
                                    <span>{formatCurrency(studentShippingPortion)}</span>
                                  </div>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    paddingTop: '0.25rem',
                                    borderTop: '1px solid #dee2e6',
                                    fontWeight: 'bold'
                                  }}>
                                    <span>Student Total:</span>
                                    <span>
                                      {formatCurrency(
                                        student.subtotal - 
                                        Math.abs(studentDiscountPortion) +
                                        studentTaxPortion +
                                        studentShippingPortion
                                      )}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                        })})()}
                      
                      <div className="orders__items-summary" style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '0.5rem',
                        border: '1px solid #dee2e6'
                      }}>
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Order Summary</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span>Total Students:</span>
                          <strong>{selectedOrder?.galleryOrders?.length || selectedOrder?.itemsByStudent?.length || 0}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span>Total Items:</span>
                          <strong>{selectedOrder?.items?.reduce((sum, item) => sum + (item?.quantity || 0), 0) || 0}</strong>
                        </div>
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #dee2e6' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span>Items Total:</span>
                            <span>{formatCurrency(
                              (selectedOrder?.itemsByStudent || []).reduce((sum, s) => sum + (s.subtotal || 0), 0) ||
                              (selectedOrder?.items || []).reduce((sum, item) => sum + ((item.quantity || 1) * (item.price || 0)), 0) ||
                              0
                            )}</span>
                          </div>
                          {selectedOrder?.discount !== 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span>Discount:</span>
                              <span style={{ color: '#dc3545' }}>
                                -{formatCurrency(Math.abs(selectedOrder?.discount || 0))}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span>Tax:</span>
                            <span>{formatCurrency(selectedOrder?.tax || 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                            <span>Shipping:</span>
                            <span>{formatCurrency(selectedOrder?.shipping || 0)}</span>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            paddingTop: '0.25rem',
                            borderTop: '1px solid #dee2e6',
                            fontSize: '1.1rem',
                            fontWeight: 'bold'
                          }}>
                            <span>Order Total:</span>
                            <span>{formatCurrency(selectedOrder?.total || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedOrder?.items && selectedOrder.items.length > 0 ? (
                    <div className="orders__detail-section">
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>
                          <ShoppingCart size={20} className="orders__section-icon" /> 
                          Order Items ({selectedOrder?.items?.length || 0})
                        </h3>
                        {selectedOrder?.galleryName && (
                          <p style={{ 
                            margin: 0, 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.875rem',
                            paddingLeft: '1.75rem'
                          }}>
                            {selectedOrder.galleryName}
                          </p>
                        )}
                      </div>
                      <div className="orders__items-enhanced">
                        {selectedOrder.items.map((item, index) => (
                          <div key={item.id || index} className="orders__item-card">
                            <div className="orders__item-image">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.productName} />
                              ) : (
                                <div className="orders__item-placeholder">
                                  <Image size={24} />
                                </div>
                              )}
                            </div>
                            <div className="orders__item-details">
                              <h4>{item.productName}</h4>
                              {item.studentName && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                  <User size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                  {item.studentName}
                                </p>
                              )}
                              {item.productId && (
                                <p className="orders__item-id">
                                  Product ID: {item.productId}
                                  <button 
                                    className="orders__copy-btn"
                                    onClick={() => copyToClipboard(item.productId, `product-${index}`)}
                                    title="Copy product ID"
                                  >
                                    {copiedField === `product-${index}` ? <CheckCircle size={14} /> : <Copy size={14} />}
                                  </button>
                                </p>
                              )}
                              {item.options && item.options.length > 0 && (
                                <div className="orders__item-options">
                                  <label>Options:</label>
                                  <ul>
                                    {item.options.map((option, optIndex) => (
                                      <li key={optIndex}>{option}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <div className="orders__item-pricing">
                              <div className="orders__item-price">
                                <label>Unit Price</label>
                                <p>{formatCurrency(item.price)}</p>
                              </div>
                              <div className="orders__item-quantity">
                                <label>Quantity</label>
                                <p>{item.quantity}</p>
                              </div>
                              <div className="orders__item-total">
                                <label>Total</label>
                                <p className="orders__item-total-value">{formatCurrency(item.total)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="orders__items-summary">
                        <p>Total Items: {selectedOrder?.items?.reduce((sum, item) => sum + (item?.quantity || 0), 0) || 0}</p>
                        <p>Subtotal: {formatCurrency(selectedOrder?.subtotal || 0)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="orders__empty-state">
                      <ShoppingCart size={48} />
                      <p>No items found in this order</p>
                    </div>
                  )}
                </div>
              )}

              {/* Gallery Tab */}
              {activeTab === 'gallery' && (
                <div className="orders__tab-content">
                  {selectedOrder?.galleryOrders && selectedOrder.galleryOrders.length > 0 ? (
                    <div className="orders__detail-section">
                      <h3><Users size={20} className="orders__section-icon" /> Gallery Information</h3>
                      
                      {selectedOrder.galleryOrders.map((go, index) => (
                        <div key={go.id || index} className="orders__gallery-card">
                          <div className="orders__gallery-header">
                            <h4>{go.gallery?.title || `Gallery ${index + 1}`}</h4>
                            {go.gallery?.id && (
                              <span className="orders__gallery-id">
                                ID: {go.gallery.id}
                                <button 
                                  className="orders__copy-btn"
                                  onClick={() => copyToClipboard(go.gallery.id, `gallery-${index}`)}
                                  title="Copy gallery ID"
                                >
                                  {copiedField === `gallery-${index}` ? <CheckCircle size={14} /> : <Copy size={14} />}
                                </button>
                              </span>
                            )}
                          </div>
                          
                          <div className="orders__student-details">
                            {go?.studentName && (
                              <div className="orders__student-item">
                                <label>Student Identifier:</label>
                                <p>{go?.studentName || 'N/A'}</p>
                              </div>
                            )}
                            
                            {go?.subject && (
                              <div className="orders__subject-card">
                                <h5>Subject Information</h5>
                                <div className="orders__subject-grid">
                                  <div className="orders__subject-item">
                                    <label>Full Name:</label>
                                    <p>{go.subject?.firstName || ''} {go.subject?.lastName || ''}</p>
                                  </div>
                                  {go.subject?.grade && (
                                    <div className="orders__subject-item">
                                      <label>Grade:</label>
                                      <p>{go.subject.grade}</p>
                                    </div>
                                  )}
                                  {go.subject?.teacher && (
                                    <div className="orders__subject-item">
                                      <label>Teacher:</label>
                                      <p>{go.subject.teacher}</p>
                                    </div>
                                  )}
                                  {go.subject?.id && (
                                    <div className="orders__subject-item">
                                      <label>Subject ID:</label>
                                      <p>{go.subject.id}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {go?.customData && Object.keys(go.customData).length > 0 && (
                              <div className="orders__custom-data">
                                <h5>Custom Data</h5>
                                <div className="orders__custom-fields">
                                  {Object.entries(go.customData).map(([key, value]) => (
                                    <div key={key} className="orders__custom-field">
                                      <label>{key}:</label>
                                      <p>{String(value)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="orders__empty-state">
                      <Users size={48} />
                      <p>No gallery information available</p>
                    </div>
                  )}
                </div>
              )}

              {/* Financial Tab */}
              {activeTab === 'financial' && (
                <div className="orders__tab-content">
                  <div className="orders__financial-grid">
                    <div className="orders__detail-section">
                      <h3><DollarSign size={20} className="orders__section-icon" /> Pricing Breakdown</h3>
                      <div className="orders__pricing-table">
                        <div className="orders__pricing-row">
                          <span>Subtotal</span>
                          <span>{formatCurrency(selectedOrder?.subtotal || 0)}</span>
                        </div>
                        {selectedOrder?.discount > 0 && (
                          <>
                            <div className="orders__pricing-row orders__pricing-row--discount">
                              <span>
                                Discount
                                {selectedOrder?.discountCode && <span className="orders__discount-code"> ({selectedOrder.discountCode})</span>}
                              </span>
                              <span className="orders__discount">-{formatCurrency(selectedOrder.discount)}</span>
                            </div>
                            <div className="orders__pricing-row orders__pricing-row--subtotal">
                              <span>After Discount</span>
                              <span>{formatCurrency((selectedOrder?.subtotal || 0) - (selectedOrder?.discount || 0))}</span>
                            </div>
                          </>
                        )}
                        <div className="orders__pricing-row">
                          <span>Tax</span>
                          <span>{formatCurrency(selectedOrder?.tax || 0)}</span>
                        </div>
                        <div className="orders__pricing-row">
                          <span>Shipping</span>
                          <span>{formatCurrency(selectedOrder?.shipping || 0)}</span>
                        </div>
                        {selectedOrder?.handling > 0 && (
                          <div className="orders__pricing-row">
                            <span>Handling</span>
                            <span>{formatCurrency(selectedOrder.handling)}</span>
                          </div>
                        )}
                        {selectedOrder?.commission > 0 && (
                          <div className="orders__pricing-row">
                            <span>Commission</span>
                            <span>{formatCurrency(selectedOrder.commission)}</span>
                          </div>
                        )}
                        {selectedOrder?.transactionFee > 0 && (
                          <div className="orders__pricing-row">
                            <span>Transaction Fee</span>
                            <span>{formatCurrency(selectedOrder.transactionFee)}</span>
                          </div>
                        )}
                        {selectedOrder?.processingFee > 0 && (
                          <div className="orders__pricing-row">
                            <span>Processing Fee</span>
                            <span>{formatCurrency(selectedOrder.processingFee)}</span>
                          </div>
                        )}
                        {selectedOrder?.digitalProductFee > 0 && (
                          <div className="orders__pricing-row">
                            <span>Digital Product Fee</span>
                            <span>{formatCurrency(selectedOrder.digitalProductFee)}</span>
                          </div>
                        )}
                        <div className="orders__pricing-row orders__pricing-row--total">
                          <span>Total</span>
                          <span>{formatCurrency(selectedOrder?.total || 0)}</span>
                        </div>
                        {selectedOrder?.amountRefunded > 0 && (
                          <div className="orders__pricing-row orders__pricing-row--refund">
                            <span>Amount Refunded</span>
                            <span className="orders__refund">-{formatCurrency(selectedOrder.amountRefunded)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="orders__detail-section">
                      <h3><CreditCard size={20} className="orders__section-icon" /> Payment Information</h3>
                      <div className="orders__payment-details">
                        <div className="orders__payment-item">
                          <label>Payment Status</label>
                          <p className={`orders__status orders__status--large ${getStatusClass(selectedOrder?.paymentStatus || 'pending')}`}>
                            {selectedOrder?.paymentStatus || 'pending'}
                          </p>
                        </div>
                        <div className="orders__payment-item">
                          <label>Payment Type</label>
                          <p>{selectedOrder?.paymentType || 'Not specified'}</p>
                        </div>
                        <div className="orders__payment-item">
                          <label>Currency</label>
                          <p>{selectedOrder?.currency || 'USD'}</p>
                        </div>
                        {selectedOrder?.merchant && (
                          <div className="orders__payment-item">
                            <label>Merchant</label>
                            <p>{selectedOrder.merchant}</p>
                          </div>
                        )}
                        {selectedOrder?.merchantID && (
                          <div className="orders__payment-item">
                            <label>Merchant ID</label>
                            <p>
                              {selectedOrder.merchantID}
                              <button 
                                className="orders__copy-btn"
                                onClick={() => copyToClipboard(selectedOrder.merchantID, 'merchantId')}
                                title="Copy merchant ID"
                              >
                                {copiedField === 'merchantId' ? <CheckCircle size={14} /> : <Copy size={14} />}
                              </button>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced Tab */}
              {activeTab === 'advanced' && (
                <div className="orders__tab-content">
                  <div className="orders__detail-section">
                    <h3><Info size={20} className="orders__section-icon" /> System Information</h3>
                    <div className="orders__detail-grid">
                      <div className="orders__detail-item">
                        <label>Order ID:</label>
                        <span>
                          {selectedOrder?.id || 'N/A'}
                          <button 
                            className="orders__copy-btn"
                            onClick={() => copyToClipboard(selectedOrder.id, 'orderId')}
                            title="Copy order ID"
                          >
                            {copiedField === 'orderId' ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </button>
                        </span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Account ID:</label>
                        <span>
                          {selectedOrder?.accountID || 'N/A'}
                          {selectedOrder?.accountID && (
                            <button 
                              className="orders__copy-btn"
                              onClick={() => copyToClipboard(selectedOrder.accountID, 'accountId')}
                              title="Copy account ID"
                            >
                              {copiedField === 'accountId' ? <CheckCircle size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Order Status:</label>
                        <span>{selectedOrder?.status || 'N/A'}</span>
                      </div>
                      <div className="orders__detail-item">
                        <label>Gallery ID:</label>
                        <span>{selectedOrder?.galleryId || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {selectedOrder?.serviceOrders && selectedOrder.serviceOrders.length > 0 && (
                    <div className="orders__detail-section">
                      <h3><Package size={20} className="orders__section-icon" /> Service Orders</h3>
                      <div className="orders__service-list">
                        {selectedOrder.serviceOrders.map((service, index) => (
                          <div key={service.id || index} className="orders__service-card">
                            <div className="orders__service-header">
                              <h5>Service Order {index + 1}</h5>
                              {service.id && <span className="orders__service-id">ID: {service.id}</span>}
                            </div>
                            <div className="orders__service-details">
                              <div className="orders__service-item">
                                <label>Lab:</label>
                                <p>{service.lab || 'Not specified'}</p>
                              </div>
                              <div className="orders__service-item">
                                <label>Status:</label>
                                <p className={`orders__status ${getStatusClass(service.status)}`}>
                                  {service.status || 'Unknown'}
                                </p>
                              </div>
                              {service.labOrderID && (
                                <div className="orders__service-item">
                                  <label>Lab Order ID:</label>
                                  <p>
                                    {service.labOrderID}
                                    <button 
                                      className="orders__copy-btn"
                                      onClick={() => copyToClipboard(service.labOrderID, `labOrder-${index}`)}
                                      title="Copy lab order ID"
                                    >
                                      {copiedField === `labOrder-${index}` ? <CheckCircle size={14} /> : <Copy size={14} />}
                                    </button>
                                  </p>
                                </div>
                              )}
                              {service.shipVia && (
                                <div className="orders__service-item">
                                  <label>Ship Via:</label>
                                  <p>{service.shipVia}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOrder?.notes && (
                    <div className="orders__detail-section">
                      <h3><FileText size={20} className="orders__section-icon" /> Order Notes</h3>
                      <div className="orders__notes-box">
                        <p>{selectedOrder.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="orders__detail-section">
                    <div className="orders__raw-json-header">
                      <h3><FileText size={20} className="orders__section-icon" /> Raw Order Data</h3>
                      <button 
                        className="orders__json-toggle"
                        onClick={() => setShowRawJson(!showRawJson)}
                      >
                        {showRawJson ? 'Hide' : 'Show'} Raw JSON
                      </button>
                    </div>
                    
                    {showRawJson && (
                      <div className="orders__raw-json-container">
                        {/* Orders List API Response (if viewing from list) */}
                        {originalApiResponse && (
                          <div style={{marginBottom: '2rem'}}>
                            <h4 style={{marginBottom: '0.5rem'}}>Orders List API Response</h4>
                            <button 
                              className="orders__copy-json"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(originalApiResponse, null, 2));
                                copyToClipboard(JSON.stringify(originalApiResponse, null, 2), 'list-api');
                              }}
                            >
                              {copiedField === 'list-api' ? 'Copied!' : 'Copy List Response'}
                            </button>
                            <pre className="orders__raw-json">
                              {JSON.stringify(originalApiResponse, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Full API Response (for individual order) */}
                        {selectedOrder?.fullApiResponse && (
                          <div style={{marginBottom: '2rem'}}>
                            <h4 style={{marginBottom: '0.5rem'}}>Order API Response</h4>
                            <button 
                              className="orders__copy-json"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(selectedOrder.fullApiResponse, null, 2));
                                copyToClipboard(JSON.stringify(selectedOrder.fullApiResponse, null, 2), 'full-api');
                              }}
                            >
                              {copiedField === 'full-api' ? 'Copied!' : 'Copy Order Response'}
                            </button>
                            <pre className="orders__raw-json">
                              {JSON.stringify(selectedOrder.fullApiResponse, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {/* Order Data Only */}
                        {selectedOrder?.rawData && (
                          <div>
                            <h4 style={{marginBottom: '0.5rem'}}>Order Data Only</h4>
                            <button 
                              className="orders__copy-json"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(selectedOrder.rawData, null, 2));
                                copyToClipboard(JSON.stringify(selectedOrder.rawData, null, 2), 'json');
                              }}
                            >
                              {copiedField === 'json' ? 'Copied!' : 'Copy Order Data'}
                            </button>
                            <pre className="orders__raw-json">
                              {JSON.stringify(selectedOrder.rawData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Orders;