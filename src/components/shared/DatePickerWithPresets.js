// src/components/shared/DatePickerWithPresets.js
import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import './DatePickerWithPresets.css';

const DatePickerWithPresets = ({
  value,
  onChange,
  minDate = (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  })(),
  placeholder = 'Select date',
  disabled = false,
  showPresets = true
}) => {
  // Preset date calculations - Use local timezone, not UTC
  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const year = nextWeek.getFullYear();
    const month = String(nextWeek.getMonth() + 1).padStart(2, '0');
    const day = String(nextWeek.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getNextMonth = () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const year = nextMonth.getFullYear();
    const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const day = String(nextMonth.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
