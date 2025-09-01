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
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import './CapturaStats.css';

const CapturaStats = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(new Date('2025-08-31'));
  const [stats, setStats] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);
  const [error, setError] = useState(null);

  // Load stats on mount and when period/date changes
  useEffect(() => {
    // Clear cache on mount to ensure fresh data
    if (selectedDate.toDateString() === new Date('2025-08-31').toDateString()) {
      console.log('Clearing cache for fresh August 31 data load');
      capturaStatsService.clearCache();
    }
    loadStats();
    loadSyncStatus();
  }, [selectedPeriod, selectedDate]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      
      console.log(`CapturaStats: Loading ${selectedPeriod} stats for ${selectedDate.toDateString()} (${selectedDate.toISOString().split('T')[0]})`);
      
      switch (selectedPeriod) {
        case 'day':
          data = await capturaStatsService.getDailyStats(selectedDate);
          console.log(`CapturaStats: Daily stats result:`, data);
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
      setError('Failed to load statistics. Please try again.');
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
      capturaStatsService.clearCache();
      await loadStats();
      await loadSyncStatus();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncData = async () => {
    setSyncing(true);
    setError(null);
    try {
      // Use August 31, 2025 since that's when we know there are orders
      const startDate = new Date('2025-08-31');
      const endDate = new Date('2025-08-31');

      console.log('Syncing data for date range:', startDate.toDateString(), 'to', endDate.toDateString());
      const result = await capturaStatsService.triggerBackfill(startDate, endDate, true); // Force overwrite
      console.log('Backfill result:', result);
      
      if (result.success) {
        // Refresh data after successful sync
        await loadStats();
        await loadSyncStatus();
      } else {
        setError('Sync completed but no data was processed.');
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      setError('Failed to sync data: ' + error.message);
    } finally {
      setSyncing(false);
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
    return capturaStatsService.formatCurrency(amount);
  };

  const formatNumber = (num) => {
    return capturaStatsService.formatNumber(num);
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
    const galleries = data.topGalleries || Object.entries(data.ordersByGallery || {})
      .map(([name, data]) => ({
        name,
        orders: data.count || data.orders,
        revenue: data.revenue,
        percentage: (data.revenue / (stats.totalRevenue || 1)) * 100
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    galleries.forEach(gallery => {
      rows.push([
        gallery.name,
        gallery.orders,
        formatCurrency(gallery.revenue),
        `${gallery.percentage.toFixed(1)}%`
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
            className="captura-stats__sync-btn"
            onClick={handleSyncData}
            disabled={syncing}
            style={{ 
              backgroundColor: syncing ? '#ccc' : '#007bff',
              color: 'white',
              marginRight: '8px'
            }}
          >
            <RefreshCw className={syncing ? 'spinning' : ''} size={16} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
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
          <Clock size={14} />
          <p>
            Last sync: {new Date(syncStatus.timestamp).toLocaleString()}
            {syncStatus.status === 'completed' && (
              <span className="status-success"> ✓ Completed</span>
            )}
            {syncStatus.status === 'failed' && (
              <span className="status-error"> ✗ Failed</span>
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

      {/* Error Message */}
      {error && (
        <div className="captura-stats__error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

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
                      {(stats.topGalleries || Object.entries(stats.ordersByGallery || {}))
                        .slice(0, 10)
                        .map((item, index) => {
                          const gallery = item.name ? item : {
                            name: item[0],
                            orders: item[1].count || item[1].orders,
                            revenue: item[1].revenue
                          };
                          return (
                            <tr key={gallery.name || index}>
                              <td>{gallery.name}</td>
                              <td>{formatNumber(gallery.orders)}</td>
                              <td>{formatCurrency(gallery.revenue)}</td>
                              <td>
                                {((gallery.revenue / stats.totalRevenue) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
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
                      {(stats.topSchools || Object.entries(stats.ordersBySchool || {}))
                        .slice(0, 10)
                        .map((item, index) => {
                          const school = item.name ? item : {
                            name: item[0],
                            orders: item[1].count || item[1].orders,
                            revenue: item[1].revenue,
                            topGallery: item[1].topGallery
                          };
                          return (
                            <tr key={school.name || index}>
                              <td>{school.name}</td>
                              <td>{formatNumber(school.orders)}</td>
                              <td>{formatCurrency(school.revenue)}</td>
                              <td>{school.topGallery || '-'}</td>
                            </tr>
                          );
                        })}
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

            {/* Customer Metrics (for daily stats) */}
            {stats.customerMetrics && (
              <div className="stats-section">
                <div 
                  className="section-header"
                  onClick={() => setExpandedSection(
                    expandedSection === 'customers' ? null : 'customers'
                  )}
                >
                  <h2>Customer Insights</h2>
                  <ChevronRight 
                    className={expandedSection === 'customers' ? 'rotated' : ''} 
                  />
                </div>
                
                {(expandedSection === 'customers' || selectedPeriod === 'day') && (
                  <div className="section-content">
                    <div className="customer-metrics">
                      <div className="metric-item">
                        <span className="metric-label">Unique Customers</span>
                        <span className="metric-value">{formatNumber(stats.customerMetrics.uniqueCustomers)}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Repeat Customers</span>
                        <span className="metric-value">{formatNumber(stats.customerMetrics.repeatCustomers)}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">New Customers</span>
                        <span className="metric-value">{formatNumber(stats.customerMetrics.newCustomers)}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Avg Items per Order</span>
                        <span className="metric-value">{stats.customerMetrics.averageItemsPerOrder.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Breakdown (for daily stats) */}
            {stats.paymentBreakdown && (
              <div className="stats-section">
                <div 
                  className="section-header"
                  onClick={() => setExpandedSection(
                    expandedSection === 'payments' ? null : 'payments'
                  )}
                >
                  <h2>Payment Status</h2>
                  <ChevronRight 
                    className={expandedSection === 'payments' ? 'rotated' : ''} 
                  />
                </div>
                
                {(expandedSection === 'payments' || selectedPeriod === 'day') && (
                  <div className="section-content">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Orders</th>
                          <th>Amount</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.paymentBreakdown || {}).map(([status, data]) => (
                          <tr key={status}>
                            <td className="payment-status">
                              <span className={`status-badge status-${status}`}>
                                {status}
                              </span>
                            </td>
                            <td>{formatNumber(data.count)}</td>
                            <td>{formatCurrency(data.amount)}</td>
                            <td>{data.percentage.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="captura-stats__no-data">
          <p>No data available for the selected period.</p>
          <p className="hint">Data may not have been synced yet for this date range.</p>
        </div>
      )}
    </div>
  );
};

export default CapturaStats;