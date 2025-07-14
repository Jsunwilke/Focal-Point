// src/pages/PayrollTimesheets.js
import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Download, 
  RefreshCw, 
  AlertTriangle, 
  Shield,
  Users,
  Clock,
  TrendingUp,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPayrollDataForPeriod } from '../firebase/payrollQueries';
import PayPeriodSelector from '../components/payroll/PayPeriodSelector';
import PayrollTable from '../components/payroll/PayrollTable';
import PayrollExportModal from '../components/payroll/PayrollExportModal';
import Button from '../components/shared/Button';
import './PayrollTimesheets.css';

const PayrollTimesheets = () => {
  const { userProfile, organization } = useAuth();
  const [payrollData, setPayrollData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [customDates, setCustomDates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  // Check if user has admin/manager permissions
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'manager';

  useEffect(() => {
    if (selectedPeriod && organization?.id) {
      loadPayrollData();
    }
  }, [selectedPeriod, customDates, organization]);

  const loadPayrollData = async () => {
    if (!selectedPeriod || !organization?.id) return;

    setLoading(true);
    setError('');

    try {
      let data;
      
      if (selectedPeriod.value === 'custom') {
        if (!customDates || !customDates.startDate || !customDates.endDate) {
          setError('Please select both start and end dates for custom period.');
          return;
        }
        
        data = await getPayrollDataForPeriod(
          organization.id,
          organization.payPeriodSettings,
          'custom',
          customDates
        );
      } else {
        data = await getPayrollDataForPeriod(
          organization.id,
          organization.payPeriodSettings,
          selectedPeriod.value
        );
      }

      setPayrollData(data);
    } catch (err) {
      console.error('Error loading payroll data:', err);
      setError(err.message || 'Failed to load payroll data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadPayrollData();
  };

  const handleExport = () => {
    if (payrollData) {
      setShowExportModal(true);
    }
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
    setCustomDates(null); // Reset custom dates when changing period
  };

  const handleCustomDateChange = (dates) => {
    setCustomDates(dates);
  };

  // Access control - redirect if not admin/manager
  if (!isAdmin) {
    return (
      <div className="payroll-access-denied">
        <div className="access-denied-content">
          <Shield size={64} className="access-denied-icon" />
          <h2>Access Restricted</h2>
          <p>
            Payroll timesheets are only available to administrators and managers.
            Please contact your organization administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="payroll-timesheets">
      {/* Header */}
      <div className="payroll-header">
        <div className="payroll-header-content">
          <h1 className="payroll-title">
            <Receipt size={28} />
            Payroll Timesheets
          </h1>
          <p className="payroll-subtitle">
            Review employee hours and export timesheet data for payroll processing
          </p>
        </div>
        
        <div className="payroll-header-actions">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading || !selectedPeriod}
          >
            <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            Refresh
          </Button>
          
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!payrollData || loading}
          >
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>

      {/* Pay Period Configuration Warning */}
      {organization && !organization.payPeriodSettings?.isActive && (
        <div className="payroll-warning">
          <AlertTriangle size={20} />
          <div className="payroll-warning-content">
            <strong>Pay periods not configured</strong>
            <p>
              To use automatic pay period calculation, configure pay periods in Studio Settings.
              You can still use custom date ranges below.
            </p>
          </div>
          <Button variant="secondary" size="sm">
            <Settings size={16} />
            Configure
          </Button>
        </div>
      )}

      {/* Period Selection */}
      <div className="payroll-controls">
        <PayPeriodSelector
          payPeriodSettings={organization?.payPeriodSettings}
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          onCustomDateChange={handleCustomDateChange}
          disabled={loading}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="payroll-error">
          <AlertTriangle size={20} />
          <div className="payroll-error-content">
            <strong>Error Loading Data</strong>
            <p>{error}</p>
          </div>
          <Button variant="secondary" onClick={handleRefresh}>
            Try Again
          </Button>
        </div>
      )}

      {/* Insights Section */}
      {payrollData && payrollData.summary && !loading && (
        <div className="payroll-insights">
          <h3 className="insights-title">
            <TrendingUp size={20} />
            Period Insights
          </h3>
          
          <div className="insights-grid">
            {/* Top Performers */}
            {payrollData.summary.insights.topPerformers.length > 0 && (
              <div className="insight-card">
                <h4 className="insight-card-title">
                  <Users size={16} />
                  Top Performers
                </h4>
                <div className="top-performers-list">
                  {payrollData.summary.insights.topPerformers.slice(0, 3).map((performer, index) => (
                    <div key={index} className="performer-item">
                      <span className="performer-rank">#{index + 1}</span>
                      <span className="performer-name">{performer.name}</span>
                      <span className="performer-hours">{performer.hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance Overview */}
            <div className="insight-card">
              <h4 className="insight-card-title">
                <Clock size={16} />
                Attendance
              </h4>
              <div className="attendance-stats">
                <div className="attendance-stat">
                  <span className="attendance-number attendance-number--good">
                    {payrollData.summary.insights.attendance.perfect}
                  </span>
                  <span className="attendance-label">Perfect Attendance</span>
                </div>
                <div className="attendance-stat">
                  <span className="attendance-number attendance-number--warning">
                    {payrollData.summary.insights.attendance.needs_attention}
                  </span>
                  <span className="attendance-label">Needs Attention</span>
                </div>
              </div>
            </div>

            {/* Overtime Summary */}
            {payrollData.summary.insights.overtime.employees_with_overtime > 0 && (
              <div className="insight-card">
                <h4 className="insight-card-title">
                  <AlertTriangle size={16} />
                  Overtime Alert
                </h4>
                <div className="overtime-summary">
                  <div className="overtime-stat">
                    <span className="overtime-number">
                      {payrollData.summary.insights.overtime.employees_with_overtime}
                    </span>
                    <span className="overtime-label">Employees with OT</span>
                  </div>
                  <div className="overtime-total">
                    {payrollData.summary.insights.overtime.total_overtime_hours.toFixed(1)} total OT hours
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="payroll-content">
        <PayrollTable
          payrollData={payrollData}
          loading={loading}
          onEmployeeSelect={(employee) => {
            // Future: Navigate to individual employee detail view
            console.log('Selected employee:', employee);
          }}
        />
      </div>

      {/* Export Modal */}
      <PayrollExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        payrollData={payrollData}
        period={selectedPeriod}
      />
    </div>
  );
};

export default PayrollTimesheets;