// src/components/tasks/calendar/CalendarWeekView.js
import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import CalendarTaskCard from './CalendarTaskCard';
import {
  getWeekBounds,
  getDayNames,
  isToday,
  isSameDay,
  formatMonthDay,
  getDateKey
} from '../../../utils/calendarUtils';
import './CalendarWeekView.css';

/**
 * Week view component showing tasks for the current week with drag-and-drop support
 */
const CalendarWeekView = ({ currentDate, tasks, onTaskClick, onDateClick, onTaskReschedule }) => {
  // Get week bounds and generate days
  const weekDays = useMemo(() => {
    const { start } = getWeekBounds(currentDate);
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }

    return days;
  }, [currentDate]);

  // Group tasks by date
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

  const dayNames = getDayNames(true);

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
      <div className="calendar-week-view">
        {weekDays.map((date, index) => {
          const dateKey = getDateKey(date);
          const dayTasks = tasksByDate[dateKey] || [];
          const isTodayDate = isToday(date);

          return (
            <Droppable droppableId={dateKey} key={dateKey}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`calendar-week-view__day ${
                    isTodayDate ? 'calendar-week-view__day--today' : ''
                  } ${
                    snapshot.isDraggingOver ? 'calendar-week-view__day--drag-over' : ''
                  }`}
                  onClick={() => onDateClick && onDateClick(date, true)}
                >
                  <div className="calendar-week-view__day-header">
                    <div className="calendar-week-view__day-name">{dayNames[index]}</div>
                    <div className="calendar-week-view__day-date">{formatMonthDay(date)}</div>
                  </div>

                  <div className="calendar-week-view__tasks">
                    {dayTasks.map((task, taskIndex) => (
                      <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
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
                    {dayTasks.length === 0 && (
                      <div className="calendar-week-view__no-tasks">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default CalendarWeekView;
