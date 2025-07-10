// src/components/shared/TimeSelect.js
import React from "react";

const TimeSelect = ({ name, value, onChange, className, disabled }) => {
  // Generate time options in 15-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = formatDisplayTime(timeString);
        options.push({
          value: timeString,
          display: displayTime
        });
      }
    }
    return options;
  };

  // Format time for display (12-hour format)
  const formatDisplayTime = (time24) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const timeOptions = generateTimeOptions();

  const handleChange = (e) => {
    if (onChange) {
      onChange({
        target: {
          name,
          value: e.target.value
        }
      });
    }
  };

  return (
    <select
      name={name}
      value={value}
      onChange={handleChange}
      className={className}
      disabled={disabled}
    >
      <option value="">Select time</option>
      {timeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.display}
        </option>
      ))}
    </select>
  );
};

export default TimeSelect;