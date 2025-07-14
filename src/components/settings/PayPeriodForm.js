// src/components/settings/PayPeriodForm.js
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Info,
  ChevronDown
} from 'lucide-react';
import {
  PAY_PERIOD_TYPES,
  PAY_PERIOD_LABELS,
  DEFAULT_PAY_PERIOD_CONFIGS,
  validatePayPeriodConfig,
  generatePayPeriodPreview,
  getDayNames,
  getMonthDayOptions
} from '../../utils/payPeriods';

const PayPeriodForm = ({ value = {}, onChange, errors = {} }) => {
  const [localData, setLocalData] = useState({
    isActive: false,
    type: PAY_PERIOD_TYPES.BI_WEEKLY,
    config: DEFAULT_PAY_PERIOD_CONFIGS[PAY_PERIOD_TYPES.BI_WEEKLY],
    ...value
  });

  const [preview, setPreview] = useState([]);
  const [configErrors, setConfigErrors] = useState([]);

  // Update parent when local data changes
  useEffect(() => {
    onChange(localData);
  }, [localData, onChange]);

  // Generate preview when configuration changes
  useEffect(() => {
    if (localData.isActive && localData.type && localData.config) {
      try {
        const previewPeriods = generatePayPeriodPreview(localData, 3);
        setPreview(previewPeriods);
        
        // Validate configuration
        const validation = validatePayPeriodConfig(localData.type, localData.config);
        setConfigErrors(validation.errors);
      } catch (error) {
        console.error('Error generating preview:', error);
        setPreview([]);
        setConfigErrors(['Error generating preview']);
      }
    } else {
      setPreview([]);
      setConfigErrors([]);
    }
  }, [localData]);

  const handleToggleActive = (isActive) => {
    setLocalData(prev => ({
      ...prev,
      isActive
    }));
  };

  const handleTypeChange = (type) => {
    setLocalData(prev => ({
      ...prev,
      type,
      config: DEFAULT_PAY_PERIOD_CONFIGS[type]
    }));
  };

  const handleConfigChange = (key, value) => {
    setLocalData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value
      }
    }));
  };

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="pay-period-form">
      {/* Enable/Disable Toggle */}
      <div className="form-group">
        <div className="form-toggle-group">
          <label className="form-toggle-label">
            <input
              type="checkbox"
              checked={localData.isActive}
              onChange={(e) => handleToggleActive(e.target.checked)}
              className="form-toggle-input"
            />
            <span className="form-toggle-slider"></span>
            <span className="form-toggle-text">
              Enable automatic pay period calculation
            </span>
          </label>
        </div>
        <p className="form-help-text">
          When enabled, the system will automatically calculate pay periods for timesheet reports and payroll.
        </p>
      </div>

      {/* Pay Period Configuration */}
      {localData.isActive && (
        <>
          {/* Pay Period Type Selection */}
          <div className="form-group">
            <label className="form-label">
              <Calendar size={16} />
              Pay Period Type
            </label>
            <div className="pay-period-type-grid">
              {Object.entries(PAY_PERIOD_TYPES).map(([key, type]) => (
                <label key={type} className="pay-period-type-option">
                  <input
                    type="radio"
                    name="payPeriodType"
                    value={type}
                    checked={localData.type === type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="pay-period-type-radio"
                  />
                  <div className="pay-period-type-card">
                    <div className="pay-period-type-title">
                      {PAY_PERIOD_LABELS[type]}
                    </div>
                    <div className="pay-period-type-description">
                      {type === PAY_PERIOD_TYPES.WEEKLY && 'Every 7 days'}
                      {type === PAY_PERIOD_TYPES.BI_WEEKLY && 'Every 14 days'}
                      {type === PAY_PERIOD_TYPES.SEMI_MONTHLY && '1st-15th, 16th-end of month'}
                      {type === PAY_PERIOD_TYPES.MONTHLY && 'Once per month'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Type-Specific Configuration */}
          <div className="form-group">
            <label className="form-label">
              <Clock size={16} />
              Configuration
            </label>

            {localData.type === PAY_PERIOD_TYPES.WEEKLY && (
              <div className="form-field">
                <label htmlFor="dayOfWeek" className="form-field-label">
                  Week starts on:
                </label>
                <select
                  id="dayOfWeek"
                  value={localData.config.dayOfWeek || 1}
                  onChange={(e) => handleConfigChange('dayOfWeek', parseInt(e.target.value))}
                  className="form-select"
                >
                  {getDayNames().map(day => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {localData.type === PAY_PERIOD_TYPES.BI_WEEKLY && (
              <div className="form-field">
                <label htmlFor="startDate" className="form-field-label">
                  Pay period start reference date:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={localData.config.startDate || ''}
                  onChange={(e) => handleConfigChange('startDate', e.target.value)}
                  className="form-input"
                />
                <p className="form-help-text">
                  Choose any date that represents the start of a pay period. 
                  The system will calculate all future periods from this reference.
                </p>
              </div>
            )}

            {localData.type === PAY_PERIOD_TYPES.SEMI_MONTHLY && (
              <div className="form-field-group">
                <div className="form-field">
                  <label htmlFor="firstDate" className="form-field-label">
                    First period starts on:
                  </label>
                  <select
                    id="firstDate"
                    value={localData.config.firstDate || 1}
                    onChange={(e) => handleConfigChange('firstDate', parseInt(e.target.value))}
                    className="form-select"
                  >
                    {getMonthDayOptions().slice(0, 15).map(day => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="secondDate" className="form-field-label">
                    Second period starts on:
                  </label>
                  <select
                    id="secondDate"
                    value={localData.config.secondDate || 15}
                    onChange={(e) => handleConfigChange('secondDate', parseInt(e.target.value))}
                    className="form-select"
                  >
                    {getMonthDayOptions().slice(14, 31).map(day => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {localData.type === PAY_PERIOD_TYPES.MONTHLY && (
              <div className="form-field">
                <label htmlFor="dayOfMonth" className="form-field-label">
                  Month starts on:
                </label>
                <select
                  id="dayOfMonth"
                  value={localData.config.dayOfMonth || 1}
                  onChange={(e) => handleConfigChange('dayOfMonth', parseInt(e.target.value))}
                  className="form-select"
                >
                  {getMonthDayOptions().map(day => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Configuration Errors */}
          {configErrors.length > 0 && (
            <div className="form-errors">
              <AlertCircle size={16} />
              <div className="form-errors-list">
                {configErrors.map((error, index) => (
                  <div key={index} className="form-error-item">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && configErrors.length === 0 && (
            <div className="pay-period-preview">
              <div className="pay-period-preview-header">
                <CheckCircle size={16} className="pay-period-preview-icon" />
                <h4 className="pay-period-preview-title">Preview - Next 3 Pay Periods</h4>
              </div>
              <div className="pay-period-preview-list">
                {preview.map((period, index) => (
                  <div key={index} className="pay-period-preview-item">
                    <div className="pay-period-preview-label">
                      {period.label}
                    </div>
                    <div className="pay-period-preview-dates">
                      {formatDateForDisplay(period.start)} - {formatDateForDisplay(period.end)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Information */}
          <div className="form-info">
            <Info size={16} />
            <div className="form-info-content">
              <p><strong>Important:</strong> Changing pay period settings will affect how timesheet reports are calculated.</p>
              <p>Make sure to coordinate with your payroll schedule before making changes.</p>
            </div>
          </div>
        </>
      )}

      {/* Global Errors */}
      {errors.payPeriodSettings && (
        <div className="form-error form-error--global">
          {errors.payPeriodSettings}
        </div>
      )}
    </div>
  );
};

export default PayPeriodForm;