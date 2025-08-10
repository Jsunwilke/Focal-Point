// src/components/dashboard/HoursTrackingWidget.js
import React, { useState, useEffect } from 'react';
import { Clock, Target } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getWeekTimeEntries, 
  getTimeEntries, 
  calculateTotalHours, 
  formatDuration 
} from '../../firebase/firestore';
import { getCurrentPayPeriod } from '../../utils/payPeriods';
import './HoursTrackingWidget.css';

const HoursTrackingWidget = () => {
  const { user, organization } = useAuth();
  const [weekHours, setWeekHours] = useState(0);
  const [periodHours, setPeriodHours] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firstWeekHours, setFirstWeekHours] = useState(0);
  const [secondWeekHours, setSecondWeekHours] = useState(0);

  // Get start and end of current week (Monday to Sunday)
  const getWeekBounds = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    
    // Adjust to Monday (0 = Sunday, 1 = Monday, etc.)
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(now.getDate() + daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek, endOfWeek };
  };

  // Use the shared utility function to get current pay period
  const getPayPeriod = () => {
    if (!organization?.payPeriodSettings?.isActive) {
      return null;
    }
    
    const period = getCurrentPayPeriod(organization.payPeriodSettings);
    if (period) {
      // Convert string dates to Date objects for compatibility
      return {
        start: new Date(period.start),
        end: new Date(period.end),
        label: period.label,
        type: organization.payPeriodSettings.type
      };
    }
    return null;
  };

  useEffect(() => {
    const loadHoursData = async () => {
      if (!user || !organization) return;

      try {
        setLoading(true);
        setError('');

        // Load week hours
        const { startOfWeek, endOfWeek } = getWeekBounds();
        const weekEntries = await getWeekTimeEntries(
          user.uid, 
          organization.id, 
          startOfWeek, 
          endOfWeek
        );
        const completedWeekEntries = weekEntries.filter(entry => entry.status === 'clocked-out');
        const weekHoursTotal = calculateTotalHours(completedWeekEntries);
        setWeekHours(weekHoursTotal);

        // Load pay period hours
        const period = getPayPeriod();
        if (period) {
          setCurrentPeriod(period);
          
          const formatDate = (date) => {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          };
          
          const startString = formatDate(period.start);
          const endString = formatDate(period.end);
          
          const periodEntries = await getTimeEntries(
            user.uid, 
            organization.id, 
            startString, 
            endString
          );
          
          const completedPeriodEntries = periodEntries.filter(entry => entry.status === 'clocked-out');
          const periodHoursTotal = calculateTotalHours(completedPeriodEntries);
          setPeriodHours(periodHoursTotal);
          
          // For bi-weekly periods, calculate first and second week hours separately
          if (period.type === 'bi-weekly') {
            const firstWeekEnd = new Date(period.start);
            firstWeekEnd.setDate(firstWeekEnd.getDate() + 6);
            firstWeekEnd.setHours(23, 59, 59, 999);
            
            const secondWeekStart = new Date(firstWeekEnd);
            secondWeekStart.setDate(secondWeekStart.getDate() + 1);
            secondWeekStart.setHours(0, 0, 0, 0);
            
            // Filter entries by week
            const firstWeekEntries = completedPeriodEntries.filter(entry => {
              const entryDate = new Date(entry.date);
              return entryDate >= period.start && entryDate <= firstWeekEnd;
            });
            
            const secondWeekEntries = completedPeriodEntries.filter(entry => {
              const entryDate = new Date(entry.date);
              return entryDate >= secondWeekStart && entryDate <= period.end;
            });
            
            setFirstWeekHours(calculateTotalHours(firstWeekEntries));
            setSecondWeekHours(calculateTotalHours(secondWeekEntries));
          } else {
            setFirstWeekHours(0);
            setSecondWeekHours(0);
          }
        } else {
          setCurrentPeriod({ label: 'No period configured', type: 'none' });
          setPeriodHours(0);
          setFirstWeekHours(0);
          setSecondWeekHours(0);
        }

      } catch (err) {
        console.error('Error loading hours data:', err);
        setError('Unable to load hours data');
      } finally {
        setLoading(false);
      }
    };

    loadHoursData();
  }, [user, organization]);

  // Get target hours based on period type
  const getTargetHours = () => {
    if (!organization?.payPeriodSettings || !currentPeriod) return { week: 40, period: 80 };
    
    let periodTarget;
    switch (currentPeriod.type) {
      case 'weekly': 
        periodTarget = 40;
        break;
      case 'bi-weekly': 
        periodTarget = 80;
        break;
      case 'semi-monthly': 
        periodTarget = 86.67; // ~40 hours per week
        break;
      case 'monthly': 
        periodTarget = 173.33; // ~40 hours per week
        break;
      default: 
        periodTarget = 80;
    }
    
    return { week: 40, period: periodTarget };
  };

  if (loading) {
    return (
      <div className="hours-tracking-widget">
        <div className="widget-header">
          <div className="widget-title">
            <Clock size={16} />
            <span>Hours Tracking</span>
          </div>
        </div>
        <div className="widget-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hours-tracking-widget">
        <div className="widget-header">
          <div className="widget-title">
            <Clock size={16} />
            <span>Hours Tracking</span>
          </div>
        </div>
        <div className="widget-error">{error}</div>
      </div>
    );
  }

  const { week: weekTarget, period: periodTarget } = getTargetHours();
  
  // Calculate progress with proportional overtime handling
  const calculateProgress = (hours, target, isWeekly = false) => {
    // Handle zero hours case explicitly
    if (hours === 0) {
      return {
        total: 0,
        regular: 0,
        overtime: 0,
        overtimeHours: 0,
        hasOvertime: false
      };
    }
    
    // For weekly calculation, use organization's overtime settings
    let effectiveThreshold = target;
    if (isWeekly && organization?.overtimeSettings?.calculationMethod === 'weekly') {
      effectiveThreshold = organization.overtimeSettings.weeklyThreshold || 40;
    }
    
    const overtimeHours = Math.max(hours - effectiveThreshold, 0);
    const hasOvertime = overtimeHours > 0;
    const totalProgress = (hours / effectiveThreshold) * 100;
    
    // When over 100%, show proportional blue/orange within 100% bar width
    if (hasOvertime) {
      const regularPortion = (effectiveThreshold / hours) * 100;  // Blue portion as % of total bar
      const overtimePortion = (overtimeHours / hours) * 100;  // Orange portion as % of total bar
      
      return {
        total: totalProgress,
        regular: regularPortion,
        overtime: overtimePortion,
        overtimeHours: overtimeHours,
        hasOvertime: true
      };
    } else {
      // Under 100%, show normal progress
      return {
        total: totalProgress,
        regular: totalProgress,
        overtime: 0,
        overtimeHours: 0,
        hasOvertime: false
      };
    }
  };

  const weekStats = calculateProgress(weekHours, weekTarget, true);
  
  // Calculate period stats using the standard method for all period types
  // This ensures correct overtime calculation: total hours - target hours
  const periodStats = calculateProgress(periodHours, periodTarget);

  return (
    <div className="hours-tracking-widget">
      <div className="widget-header">
        <div className="widget-title">
          <Clock size={16} />
          <span>Hours Tracking</span>
        </div>
      </div>

      <div className="widget-content">
        {/* This Week Section */}
        <div className="hours-section">
          <div className="hours-info">
            <span className="hours-label">This Week:</span>
            <span className="hours-value">
              {formatDuration(weekHours)}/{Math.round(
                organization?.overtimeSettings?.calculationMethod === 'weekly' 
                  ? (organization.overtimeSettings.weeklyThreshold || 40)
                  : weekTarget
              )}h
              {weekStats.hasOvertime && (
                <span className="overtime-text"> ({formatDuration(weekStats.overtimeHours)} OT)</span>
              )}
            </span>
          </div>
          <div className="progress-container">
            <div 
              className={`progress-bar enhanced ${weekHours === 0 ? 'progress-bar--empty' : ''} ${weekStats.hasOvertime ? 'has-overtime' : ''}`}
              style={weekHours === 0 ? { background: '#e5e7eb' } : {}}
            >
              <div 
                className="progress-wrapper"
                style={{ width: weekStats.hasOvertime ? '100%' : `${weekStats.total}%` }}
              >
                {weekStats.regular > 0 && (
                  <div 
                    className="progress-fill progress-fill--regular"
                    style={{ width: weekStats.hasOvertime ? `${weekStats.regular}%` : '100%' }}
                  />
                )}
                {weekStats.hasOvertime && (
                  <div 
                    className="progress-fill progress-fill--overtime"
                    style={{ width: `${weekStats.overtime}%` }}
                  />
                )}
              </div>
            </div>
            <span className="progress-text">
              {Math.round(weekStats.total)}%
              {weekStats.hasOvertime && <span className="overtime-indicator"> OT</span>}
            </span>
          </div>
        </div>

        {/* Pay Period Section */}
        <div className="hours-section">
          <div className="hours-info">
            <span className="hours-label">Pay Period:</span>
            <span className="hours-value">
              {formatDuration(periodHours)}/{Math.round(periodTarget)}h
              {periodStats.hasOvertime && (
                <span className="overtime-text"> ({formatDuration(periodStats.overtimeHours)} OT)</span>
              )}
            </span>
          </div>
          <div className="progress-container">
            <div 
              className={`progress-bar enhanced ${periodHours === 0 ? 'progress-bar--empty' : ''} ${periodStats.hasOvertime ? 'has-overtime' : ''}`}
              style={periodHours === 0 ? { background: '#e5e7eb' } : {}}
            >
              <div 
                className="progress-wrapper"
                style={{ width: periodStats.isPartialOT ? `${periodStats.total}%` : (periodStats.hasOvertime ? '100%' : `${periodStats.total}%`) }}
              >
                {periodStats.regular > 0 && (
                  <div 
                    className="progress-fill progress-fill--regular"
                    style={{ width: periodStats.hasOvertime ? `${periodStats.regular}%` : '100%' }}
                  />
                )}
                {periodStats.hasOvertime && (
                  <div 
                    className="progress-fill progress-fill--overtime"
                    style={{ width: `${periodStats.overtime}%` }}
                  />
                )}
              </div>
            </div>
            <span className="progress-text">
              {Math.round(periodStats.total)}%
              {periodStats.hasOvertime && <span className="overtime-indicator"> OT</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HoursTrackingWidget;