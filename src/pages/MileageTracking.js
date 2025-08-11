// src/pages/MileageTracking.js
import React, { useState, useEffect } from 'react';
import { 
  Navigation, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  MapPin,
  TrendingUp,
  Users,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getUserMileageDataForPeriod, getUserMileageDataForCurrentMonth, getUserMileageDataForCurrentYear, exportMileageToCSV, preloadDailyReportsForMileage } from '../firebase/mileageQueries';
import PayPeriodSelector from '../components/payroll/PayPeriodSelector';
import MileageTable from '../components/mileage/MileageTable';
import Button from '../components/shared/Button';
import './MileageTracking.css';

const MileageTracking = () => {
  const { userProfile, organization, user } = useAuth();
  const [mileageData, setMileageData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [yearlyData, setYearlyData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [customDates, setCustomDates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedPeriod && organization?.id && user?.uid) {
      loadMileageData();
    }
  }, [selectedPeriod, customDates, organization, user]);

  useEffect(() => {
    if (organization?.id && user?.uid) {
      // Check if daily reports cache is available for optimized mileage loading
      preloadDailyReportsForMileage(organization.id);
      loadMonthlyAndYearlyStats();
    }
  }, [organization, user]);

  const loadMileageData = async () => {
    if (!selectedPeriod || !organization?.id || !user?.uid) return;

    setLoading(true);
    setError('');

    try {
      
      // Check cache status before loading
      const cacheAvailable = await preloadDailyReportsForMileage(organization.id);
      if (!cacheAvailable) {
      }
      
      let data;
      
      if (selectedPeriod.value === 'custom') {
        if (!customDates || !customDates.startDate || !customDates.endDate) {
          setError('Please select both start and end dates for custom period');
          setLoading(false);
          return;
        }
        data = await getUserMileageDataForPeriod(
          organization.id,
          user.uid,
          organization.payPeriodSettings,
          'custom',
          customDates
        );
      } else if (selectedPeriod.value.startsWith('historical-')) {
        data = await getUserMileageDataForPeriod(
          organization.id,
          user.uid,
          organization.payPeriodSettings,
          selectedPeriod.value,
          null,
          selectedPeriod
        );
      } else {
        data = await getUserMileageDataForPeriod(
          organization.id,
          user.uid,
          organization.payPeriodSettings,
          selectedPeriod.value
        );
      }

      setMileageData(data);
    } catch (err) {
      setError(err.message || 'Failed to load mileage data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!mileageData) return;

    try {
      const csvData = exportMileageToCSV(mileageData);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mileage-report-${mileageData.period.startDate}-to-${mileageData.period.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export mileage data');
    }
  };

  const handleRefresh = () => {
    loadMileageData();
  };

  const handlePeriodChange = (period) => {
    setSelectedPeriod(period);
  };

  const handleCustomDatesChange = (dates) => {
    setCustomDates(dates);
  };

  const loadMonthlyAndYearlyStats = async () => {
    if (!organization?.id || !user?.uid) return;

    setLoadingStats(true);
    try {
      
      // Check cache status for stats
      const cacheAvailable = await preloadDailyReportsForMileage(organization.id);
      if (!cacheAvailable) {
      }
      
      const [monthlyResult, yearlyResult] = await Promise.all([
        getUserMileageDataForCurrentMonth(organization.id, user.uid),
        getUserMileageDataForCurrentYear(organization.id, user.uid)
      ]);
      
      setMonthlyData(monthlyResult);
      setYearlyData(yearlyResult);
    } catch (err) {
      // Don't show error for stats - just log it
    } finally {
      setLoadingStats(false);
    }
  };


  return (
    <div className="mileage-tracking">
      <div className="mileage-header">
        <div className="mileage-header__content">
          <h1 className="mileage-title">
            <Navigation size={28} />
            Mileage Tracking
          </h1>
          <p className="mileage-subtitle">
            Your mileage tracking and compensation
          </p>
        </div>
        
        <div className="mileage-header__actions">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={loading || !mileageData}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="mileage-controls">
        <PayPeriodSelector
          selectedPeriod={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          customDates={customDates}
          onCustomDatesChange={handleCustomDatesChange}
          payPeriodSettings={organization?.payPeriodSettings}
        />
      </div>

      {/* Monthly and Yearly Stats */}
      {(monthlyData || yearlyData) && (
        <div className="mileage-lifetime-stats">
          <div className="mileage-lifetime-stats__header">
            <h3>Lifetime Statistics</h3>
          </div>
          
          <div className="mileage-stats mileage-stats--lifetime">
            {monthlyData && (
              <>
                <div className="mileage-stat">
                  <div className="mileage-stat__icon">
                    <Calendar size={20} />
                  </div>
                  <div className="mileage-stat__content">
                    <span className="mileage-stat__value">
                      {monthlyData.userBreakdown.totalMiles.toFixed(1)}
                    </span>
                    <span className="mileage-stat__label">Miles in {monthlyData.monthName}</span>
                  </div>
                </div>
                
                <div className="mileage-stat">
                  <div className="mileage-stat__icon">
                    <DollarSign size={20} />
                  </div>
                  <div className="mileage-stat__content">
                    <span className="mileage-stat__value">
                      ${monthlyData.userBreakdown.totalCompensation.toFixed(2)}
                    </span>
                    <span className="mileage-stat__label">Reimbursement in {monthlyData.monthName}</span>
                  </div>
                </div>
              </>
            )}
            
            {yearlyData && (
              <>
                <div className="mileage-stat">
                  <div className="mileage-stat__icon">
                    <Calendar size={20} />
                  </div>
                  <div className="mileage-stat__content">
                    <span className="mileage-stat__value">
                      {yearlyData.userBreakdown.totalMiles.toFixed(1)}
                    </span>
                    <span className="mileage-stat__label">Miles in {yearlyData.year}</span>
                  </div>
                </div>
                
                <div className="mileage-stat">
                  <div className="mileage-stat__icon">
                    <DollarSign size={20} />
                  </div>
                  <div className="mileage-stat__content">
                    <span className="mileage-stat__value">
                      ${yearlyData.userBreakdown.totalCompensation.toFixed(2)}
                    </span>
                    <span className="mileage-stat__label">Reimbursement in {yearlyData.year}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {loadingStats && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {mileageData && (
        <div className="mileage-summary">
          <div className="mileage-summary__header">
            <h2>
              Your Summary - {mileageData.period.label}
            </h2>
          </div>
          
          <div className="mileage-stats">
            <div className="mileage-stat">
              <div className="mileage-stat__icon">
                <MapPin size={20} />
              </div>
              <div className="mileage-stat__content">
                <span className="mileage-stat__value">
                  {mileageData.summary.totalMiles.toFixed(1)}
                </span>
                <span className="mileage-stat__label">Total Miles</span>
              </div>
            </div>
            
            <div className="mileage-stat">
              <div className="mileage-stat__icon">
                <TrendingUp size={20} />
              </div>
              <div className="mileage-stat__content">
                <span className="mileage-stat__value">
                  ${mileageData.summary.totalCompensation.toFixed(2)}
                </span>
                <span className="mileage-stat__label">Total Compensation</span>
              </div>
            </div>
            
            <div className="mileage-stat">
              <div className="mileage-stat__icon">
                <Users size={20} />
              </div>
              <div className="mileage-stat__content">
                <span className="mileage-stat__value">
                  {mileageData.summary.totalJobs}
                </span>
                <span className="mileage-stat__label">Total Jobs</span>
              </div>
            </div>
            
            <div className="mileage-stat">
              <div className="mileage-stat__icon">
                <Navigation size={20} />
              </div>
              <div className="mileage-stat__content">
                <span className="mileage-stat__value">
                  {mileageData.summary.averageMilesPerJob.toFixed(1)}
                </span>
                <span className="mileage-stat__label">Avg Miles/Job</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mileage-content">
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading mileage data...</p>
          </div>
        )}

        {!loading && mileageData && (
          <MileageTable
            mileageData={mileageData}
            currentUserId={user?.uid}
            onDataRefresh={loadMileageData}
          />
        )}

        {!loading && !mileageData && selectedPeriod && (
          <div className="empty-state">
            <MapPin size={48} className="empty-icon" />
            <h3>No Mileage Data Found</h3>
            <p>No mileage data was found for the selected period.</p>
          </div>
        )}

        {!loading && !selectedPeriod && (
          <div className="empty-state">
            <Navigation size={48} className="empty-icon" />
            <h3>Select a Pay Period</h3>
            <p>Choose a pay period above to view mileage tracking data.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MileageTracking;