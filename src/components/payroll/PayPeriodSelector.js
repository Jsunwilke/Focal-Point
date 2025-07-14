// src/components/payroll/PayPeriodSelector.js
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  Clock, 
  AlertTriangle,
  Settings
} from 'lucide-react';
import { getAvailablePayPeriods } from '../../firebase/payrollQueries';

const PayPeriodSelector = ({ 
  payPeriodSettings, 
  selectedPeriod, 
  onPeriodChange, 
  onCustomDateChange,
  disabled = false 
}) => {
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [customDates, setCustomDates] = useState({
    startDate: '',
    endDate: ''
  });
  const [isCustomMode, setIsCustomMode] = useState(false);

  useEffect(() => {
    if (payPeriodSettings && payPeriodSettings.isActive) {
      const periods = getAvailablePayPeriods(payPeriodSettings, 8);
      setAvailablePeriods(periods);
      
      // Set default to current period if no selection
      if (!selectedPeriod && periods.length > 0) {
        const currentPeriod = periods.find(p => p.isCurrent) || periods[0];
        onPeriodChange(currentPeriod);
      }
    } else {
      setAvailablePeriods([]);
      setIsCustomMode(true);
    }
  }, [payPeriodSettings]);

  useEffect(() => {
    if (selectedPeriod?.value === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
    }
  }, [selectedPeriod]);

  const handlePeriodSelect = (period) => {
    if (period.value === 'custom') {
      setIsCustomMode(true);
      onPeriodChange(period);
    } else {
      setIsCustomMode(false);
      onPeriodChange(period);
    }
    setShowDropdown(false);
  };

  const handleCustomDateChange = (field, value) => {
    const newCustomDates = {
      ...customDates,
      [field]: value
    };
    setCustomDates(newCustomDates);

    // If both dates are filled, notify parent
    if (newCustomDates.startDate && newCustomDates.endDate) {
      if (new Date(newCustomDates.endDate) >= new Date(newCustomDates.startDate)) {
        onCustomDateChange(newCustomDates);
      }
    }
  };

  const formatPeriodDisplay = (period) => {
    if (!period) return 'Select Pay Period';
    
    if (period.value === 'custom') {
      if (customDates.startDate && customDates.endDate) {
        return `Custom: ${formatDate(customDates.startDate)} - ${formatDate(customDates.endDate)}`;
      }
      return 'Custom Date Range';
    }
    
    return period.label;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPeriodIcon = (period) => {
    if (period?.isCurrent) return <Clock size={14} className="period-icon period-icon--current" />;
    if (period?.isPrevious) return <Calendar size={14} className="period-icon period-icon--previous" />;
    return <Calendar size={14} className="period-icon" />;
  };

  return (
    <div className="pay-period-selector">
      {/* Period Selection Dropdown */}
      <div className="period-selector-main">
        <label className="period-selector-label">
          <Calendar size={16} />
          Pay Period
        </label>
        
        <div className="period-selector-dropdown">
          <button
            className={`period-selector-button ${showDropdown ? 'period-selector-button--open' : ''}`}
            onClick={() => !disabled && setShowDropdown(!showDropdown)}
            disabled={disabled}
          >
            <span className="period-selector-text">
              {formatPeriodDisplay(selectedPeriod)}
            </span>
            <ChevronDown size={16} className={`period-selector-chevron ${showDropdown ? 'period-selector-chevron--open' : ''}`} />
          </button>

          {showDropdown && (
            <>
              <div 
                className="period-selector-overlay" 
                onClick={() => setShowDropdown(false)}
              />
              <div className="period-selector-menu">
                {/* Predefined Periods */}
                {availablePeriods.length > 0 ? (
                  <>
                    {availablePeriods.map((period) => (
                      <button
                        key={period.value}
                        className={`period-selector-option ${selectedPeriod?.value === period.value ? 'period-selector-option--selected' : ''}`}
                        onClick={() => handlePeriodSelect(period)}
                      >
                        <div className="period-option-content">
                          {getPeriodIcon(period)}
                          <div className="period-option-text">
                            <div className="period-option-label">
                              {period.label}
                            </div>
                            <div className="period-option-dates">
                              {formatDate(period.startDate)} - {formatDate(period.endDate)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    <div className="period-selector-divider" />
                  </>
                ) : (
                  <div className="period-selector-no-config">
                    <AlertTriangle size={16} />
                    <div>
                      <div className="no-config-title">No Pay Periods Configured</div>
                      <div className="no-config-subtitle">Configure pay periods in Studio Settings</div>
                    </div>
                    <Settings size={14} />
                  </div>
                )}

                {/* Custom Date Range Option */}
                <button
                  className={`period-selector-option ${selectedPeriod?.value === 'custom' ? 'period-selector-option--selected' : ''}`}
                  onClick={() => handlePeriodSelect({ value: 'custom', label: 'Custom Date Range' })}
                >
                  <div className="period-option-content">
                    <Calendar size={14} className="period-icon" />
                    <span className="period-option-label">Custom Date Range</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom Date Inputs */}
      {isCustomMode && (
        <div className="custom-date-inputs">
          <div className="custom-date-group">
            <label htmlFor="custom-start-date" className="custom-date-label">
              Start Date
            </label>
            <input
              type="date"
              id="custom-start-date"
              value={customDates.startDate}
              onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
              className="custom-date-input"
              disabled={disabled}
            />
          </div>
          
          <div className="custom-date-separator">to</div>
          
          <div className="custom-date-group">
            <label htmlFor="custom-end-date" className="custom-date-label">
              End Date
            </label>
            <input
              type="date"
              id="custom-end-date"
              value={customDates.endDate}
              onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
              className="custom-date-input"
              min={customDates.startDate}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Period Info */}
      {selectedPeriod && selectedPeriod.value !== 'custom' && (
        <div className="period-info">
          <div className="period-info-dates">
            <Calendar size={14} />
            <span>
              {formatDate(selectedPeriod.startDate)} - {formatDate(selectedPeriod.endDate)}
            </span>
          </div>
          {selectedPeriod.isCurrent && (
            <div className="period-info-badge period-info-badge--current">
              <Clock size={12} />
              Current Period
            </div>
          )}
          {selectedPeriod.isPrevious && (
            <div className="period-info-badge period-info-badge--previous">
              Previous Period
            </div>
          )}
        </div>
      )}

      {/* Custom Date Validation */}
      {isCustomMode && customDates.startDate && customDates.endDate && (
        <div className="custom-date-validation">
          {new Date(customDates.endDate) < new Date(customDates.startDate) ? (
            <div className="validation-error">
              <AlertTriangle size={14} />
              End date must be after start date
            </div>
          ) : (
            <div className="validation-success">
              <Calendar size={14} />
              Period: {formatDate(customDates.startDate)} - {formatDate(customDates.endDate)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PayPeriodSelector;