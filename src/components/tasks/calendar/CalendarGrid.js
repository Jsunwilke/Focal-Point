// src/components/tasks/calendar/CalendarGrid.js
import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import CalendarTaskCard from './CalendarTaskCard';
import {
  generateCalendarGrid,
  getTasksForDate,
  isToday,
  isPast,
  getDateKey
} from '../../../utils/calendarUtils';
import './CalendarGrid.css';

/**
 * Calendar grid component for month view
 * Shows tasks organized by date in a calendar layout with drag-and-drop support
 */
const CalendarGrid = ({ currentDate, tasks, onTaskClick, onDateClick, onTaskReschedule }) => {
  // Generate calendar grid for the current month
  const calendarGrid = useMemo(() => {
    return generateCalendarGrid(currentDate);
  }, [currentDate]);

  // Group tasks by date for efficient lookup
  const tasksByDate = useMemo(() => {
    const grouped = {};
    tasks.forEach(task => {
      if (!task.dueDate) return;

      const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      const dateKey = getDateKey(dueDate);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(task);
    });
    return grouped;
  }, [tasks]);

  const handleDateClick = (date, isCurrentMonth) => {
    if (onDateClick) {
      onDateClick(date, isCurrentMonth);
    }
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) {
      return;
    }

    // Dropped in the same position
    if (destination.droppableId === source.droppableId) {
      return;
    }

    // Get the new date from the destination droppableId (which is a date key)
    const newDateKey = destination.droppableId;
    const taskId = draggableId;

    // Call the reschedule handler if provided
    if (onTaskReschedule) {
      onTaskReschedule(taskId, newDateKey);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="calendar-grid">
      {/* Day headers */}
      <div className="calendar-grid__header">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="calendar-grid__day-header">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      <div className="calendar-grid__body">
        {calendarGrid.map((week, weekIndex) => (
          <div key={weekIndex} className="calendar-grid__week">
            {week.map((day, dayIndex) => {
              const dateKey = getDateKey(day.date);
              const dayTasks = tasksByDate[dateKey] || [];
              const isTodayDate = isToday(day.date);
              const isPastDate = isPast(day.date);

              return (
                <Droppable droppableId={dateKey} key={dateKey}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`calendar-grid__day ${
                        !day.isCurrentMonth ? 'calendar-grid__day--other-month' : ''
                      } ${
                        isTodayDate ? 'calendar-grid__day--today' : ''
                      } ${
                        isPastDate && day.isCurrentMonth ? 'calendar-grid__day--past' : ''
                      } ${
                        snapshot.isDraggingOver ? 'calendar-grid__day--drag-over' : ''
                      }`}
                      onClick={() => handleDateClick(day.date, day.isCurrentMonth)}
                    >
                      <div className="calendar-grid__day-number">
                        {day.date.getDate()}
                      </div>

                      <div className="calendar-grid__tasks">
                        {dayTasks.slice(0, 3).map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={snapshot.isDragging ? 'calendar-task-card--dragging' : ''}
                              >
                                <CalendarTaskCard
                                  task={task}
                                  onClick={onTaskClick}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {dayTasks.length > 3 && (
                          <div className="calendar-grid__more-tasks">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        ))}
      </div>
    </div>
    </DragDropContext>
  );
};

export default CalendarGrid;
