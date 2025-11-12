// src/components/tasks/calendar/CalendarTaskCard.js
import React from 'react';
import { Circle, CheckCircle } from 'lucide-react';
import { TASK_STATUS } from '../../../constants/taskStatus';
import './CalendarTaskCard.css';

/**
 * Mini task card for calendar cells
 */
const CalendarTaskCard = ({ task, onClick }) => {
  const isCompleted = task.status === TASK_STATUS.COMPLETED;

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div
      className={`calendar-task-card ${isCompleted ? 'calendar-task-card--completed' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(task.id);
      }}
      title={task.title}
    >
      <div className="calendar-task-card__content">
        {isCompleted ? (
          <CheckCircle size={10} className="calendar-task-card__icon calendar-task-card__icon--completed" />
        ) : (
          <Circle
            size={8}
            fill={getPriorityColor()}
            color={getPriorityColor()}
            className="calendar-task-card__icon"
          />
        )}
        <span className="calendar-task-card__title">{task.title}</span>
      </div>
    </div>
  );
};

export default CalendarTaskCard;
