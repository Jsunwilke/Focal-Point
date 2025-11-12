// src/components/tasks/calendar/CalendarView.js
import React, { useState } from 'react';
import { useTask } from '../../../contexts/TaskContext';
import { useToast } from '../../../contexts/ToastContext';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';
import CalendarWeekView from './CalendarWeekView';
import './CalendarView.css';

/**
 * Main calendar view component
 * Displays tasks in a calendar format with month/week views
 */
const CalendarView = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month' or 'week'
  const { updateTask } = useTask();
  const { showToast } = useToast();

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
  };

  const handleViewChange = (newView) => {
    setView(newView);
  };

  const handleDateClick = (date, isCurrentMonth) => {
    // When clicking a date from another month, navigate to that month
    if (!isCurrentMonth) {
      setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const handleTaskReschedule = async (taskId, newDateKey) => {
    try {
      // Parse the date key (YYYY-MM-DD) into a Date object
      const [year, month, day] = newDateKey.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);

      // Update the task's dueDate
      await updateTask(taskId, { dueDate: newDate });
      showToast('Task rescheduled successfully', 'success');
    } catch (error) {
      console.error('Error rescheduling task:', error);
      showToast('Failed to reschedule task', 'error');
    }
  };

  return (
    <div className="calendar-view">
      <CalendarHeader
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
      />

      {view === 'month' ? (
        <CalendarGrid
          currentDate={currentDate}
          tasks={tasks}
          onTaskClick={onTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      ) : (
        <CalendarWeekView
          currentDate={currentDate}
          tasks={tasks}
          onTaskClick={onTaskClick}
          onDateClick={handleDateClick}
          onTaskReschedule={handleTaskReschedule}
        />
      )}
    </div>
  );
};

export default CalendarView;
