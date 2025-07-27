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
import './HoursTrackingWidget.css';

const HoursTrackingWidget = () => {
  const { user, organization } = useAuth();
  const [weekHours, setWeekHours] = useState(0);
  const [periodHours, setPeriodHours] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Calculate current pay period based on organization settings
  const getCurrentPayPeriod = () => {
    if (!organization?.payPeriodSettings?.isActive) {
      return null;
    }

    const { type, config } = organization.payPeriodSettings;
    const today = new Date();

    switch (type) {
      case 'weekly':
        return getWeeklyPeriod(today, config);
      case 'bi-weekly':
        return getBiWeeklyPeriod(today, config);
      case 'semi-monthly':
        return getSemiMonthlyPeriod(today, config);
      case 'monthly':
        return getMonthlyPeriod(today, config);
      default:
        return null;
    }
  };

  const getWeeklyPeriod = (date, config) => {
    const dayOfWeek = date.getDay();
    const startDay = config.dayOfWeek || 1; // Default to Monday
    
    const daysToStart = dayOfWeek === 0 ? (7 - startDay) : (startDay - dayOfWeek);
    const start = new Date(date);
    start.setDate(date.getDate() - (dayOfWeek === 0 ? 7 - startDay : dayOfWeek - startDay));
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return {
      start,
      end,
      label: `Week of ${start.toLocaleDateString()}`,
      type: 'weekly'
    };
  };

  const getBiWeeklyPeriod = (date, config) => {
    const referenceDate = new Date(config.startDate);
    const daysDiff = Math.floor((date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    const periodNumber = Math.floor(daysDiff / 14);
    
    const start = new Date(referenceDate);
    start.setDate(referenceDate.getDate() + (periodNumber * 14));
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    end.setHours(23, 59, 59, 999);
    
    return {
      start,
      end,
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      type: 'bi-weekly'
    };
  };

  const getSemiMonthlyPeriod = (date, config) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const firstDate = config.firstDate || 1;
    const secondDate = config.secondDate || 15;
    
    if (day < secondDate) {
      // First half of month
      const start = new Date(year, month, firstDate);
      const end = new Date(year, month, secondDate - 1, 23, 59, 59, 999);
      return {
        start,
        end,
        label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        type: 'semi-monthly'
      };
    } else {
      // Second half of month
      const start = new Date(year, month, secondDate);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month
      return {
        start,
        end,
        label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        type: 'semi-monthly'
      };
    }
  };

  const getMonthlyPeriod = (date, config) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDay = config.dayOfMonth || 1;
    
    let start, end;
    
    if (date.getDate() >= startDay) {
      // Current period
      start = new Date(year, month, startDay);
      end = new Date(year, month + 1, startDay - 1, 23, 59, 59, 999);
    } else {
      // Previous period
      start = new Date(year, month - 1, startDay);
      end = new Date(year, month, startDay - 1, 23, 59, 59, 999);
    }
    
    return {
      start,
      end,
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      type: 'monthly'
    };
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
        const period = getCurrentPayPeriod();
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
        } else {
          setCurrentPeriod({ label: 'No period configured', type: 'none' });
          setPeriodHours(0);
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
  
  // Calculate progress with overtime handling
  const calculateProgress = (hours, target) => {
    const regularHours = Math.min(hours, target);
    const overtimeHours = Math.max(hours - target, 0);
    const totalProgress = (hours / target) * 100;
    const regularProgress = (regularHours / target) * 100;
    const overtimeProgress = totalProgress > 100 ? ((overtimeHours / hours) * 100) : 0;
    
    return {
      total: totalProgress,
      regular: regularProgress,
      overtime: overtimeProgress,
      overtimeHours: overtimeHours,
      hasOvertime: overtimeHours > 0
    };
  };

  const weekStats = calculateProgress(weekHours, weekTarget);
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
              {formatDuration(weekHours)}/{Math.round(weekTarget)}h
              {weekStats.hasOvertime && (
                <span className="overtime-text"> ({formatDuration(weekStats.overtimeHours)} OT)</span>
              )}
            </span>
          </div>
          <div className="progress-container">
            <div className="progress-bar enhanced">
              <div 
                className="progress-fill progress-fill--regular"
                style={{ width: `${Math.min(weekStats.regular, 100)}%` }}
              />
              {weekStats.hasOvertime && (
                <div 
                  className="progress-fill progress-fill--overtime"
                  style={{ 
                    width: `${(weekStats.overtimeHours / weekHours) * 100}%`,
                    left: `${Math.min(weekStats.regular, 100)}%`
                  }}
                />
              )}
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
            <div className="progress-bar enhanced">
              <div 
                className="progress-fill progress-fill--regular"
                style={{ width: `${Math.min(periodStats.regular, 100)}%` }}
              />
              {periodStats.hasOvertime && (
                <div 
                  className="progress-fill progress-fill--overtime"
                  style={{ 
                    width: `${(periodStats.overtimeHours / periodHours) * 100}%`,
                    left: `${Math.min(periodStats.regular, 100)}%`
                  }}
                />
              )}
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