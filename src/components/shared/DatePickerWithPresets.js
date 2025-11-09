// src/components/shared/DatePickerWithPresets.js
import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import './DatePickerWithPresets.css';

const DatePickerWithPresets = ({
  value,
  onChange,
  minDate = new Date().toISOString().split('T')[0],
  placeholder = 'Select date',
  disabled = false,
  showPresets = true
}) => {
  // Preset date calculations
  const getToday = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  };

  const getNextMonth = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split('T')[0];
  };

  // Preset configurations
  const presets = [
    { label: 'Today', value: getToday(), icon: Calendar },
    { label: 'Tomorrow', value: getTomorrow(), icon: Calendar },
    { label: 'Next Week', value: getNextWeek(), icon: Clock },
    { label: 'Next Month', value: getNextMonth(), icon: Clock }
  ];

  const handlePresetClick = (presetValue) => {
    if (!disabled) {
      onChange({ target: { value: presetValue } });
    }
  };

  const handleDateChange = (e) => {
    onChange(e);
  };

  const handleClear = () => {
    if (!disabled) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className="date-picker-with-presets">
      <div className="date-picker-with-presets__input-wrapper">
        <input
          type="date"
          value={value}
          onChange={handleDateChange}
          min={minDate}
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker-with-presets__input"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="date-picker-with-presets__clear-btn"
            aria-label="Clear date"
          >
            ×
          </button>
        )}
      </div>

      {showPresets && (
        <div className="date-picker-with-presets__presets">
          {presets.map((preset) => {
            const Icon = preset.icon;
            const isSelected = value === preset.value;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset.value)}
                disabled={disabled}
                className={`date-picker-preset-btn ${isSelected ? 'date-picker-preset-btn--active' : ''}`}
                aria-label={`Set date to ${preset.label}`}
              >
                <Icon size={14} />
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DatePickerWithPresets;
