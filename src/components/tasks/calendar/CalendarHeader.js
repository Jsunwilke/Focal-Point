// src/components/tasks/calendar/CalendarHeader.js
import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import { formatMonthYear, getPreviousMonth, getNextMonth } from '../../../utils/calendarUtils';
import './CalendarHeader.css';

/**
 * Calendar header with navigation and view controls
 */
const CalendarHeader = ({
  currentDate,
  onDateChange,
  view,
  onViewChange
}) => {
  const handlePreviousMonth = () => {
    onDateChange(getPreviousMonth(currentDate));
  };

  const handleNextMonth = () => {
    onDateChange(getNextMonth(currentDate));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="calendar-header">
      <div className="calendar-header__navigation">
        <button
          className="calendar-header__nav-button"
          onClick={handlePreviousMonth}
          title="Previous month"
        >
          <ChevronLeft size={20} />
        </button>

        <h2 className="calendar-header__title">
          {formatMonthYear(currentDate)}
        </h2>

        <button
          className="calendar-header__nav-button"
          onClick={handleNextMonth}
          title="Next month"
        >
          <ChevronRight size={20} />
        </button>

        <button
          className="calendar-header__today-button"
          onClick={handleToday}
        >
          Today
        </button>
      </div>

      <div className="calendar-header__views">
        <button
          className={`calendar-header__view-button ${
            view === 'month' ? 'calendar-header__view-button--active' : ''
          }`}
          onClick={() => onViewChange('month')}
          title="Month view"
        >
          <Calendar size={18} />
          <span>Month</span>
        </button>

        <button
          className={`calendar-header__view-button ${
            view === 'week' ? 'calendar-header__view-button--active' : ''
          }`}
          onClick={() => onViewChange('week')}
          title="Week view"
        >
          <List size={18} />
          <span>Week</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
