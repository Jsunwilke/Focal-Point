// src/components/tasks/TaskBoardColumn.js
import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import TaskBoardCard from './TaskBoardCard';
import './TaskBoardColumn.css';

const TaskBoardColumn = ({ status, tasks, onTaskClick, users }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'todo':
        return { label: 'To Do', icon: '📋', color: '#6b7280' };
      case 'in_progress':
        return { label: 'In Progress', icon: '⚡', color: '#3b82f6' };
      case 'on_hold':
        return { label: 'On Hold', icon: '⏳', color: '#ef4444' };
      case 'completed':
        return { label: 'Completed', icon: '✅', color: '#10b981' };
      default:
        return { label: status, icon: '📌', color: '#6b7280' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="task-board-column">
      <div className="task-board-column__header">
        <div className="task-board-column__title">
          <span className="task-board-column__icon">{config.icon}</span>
          <h3>{config.label}</h3>
          <span className="task-board-column__count">{tasks.length}</span>
        </div>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`task-board-column__content ${snapshot.isDraggingOver ? 'task-board-column__content--dragging-over' : ''}`}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="task-board-column__empty">
                <p>No tasks</p>
              </div>
            )}

            {tasks.map((task, index) => (
              <TaskBoardCard
                key={task.id}
                task={task}
                index={index}
                onClick={onTaskClick}
                users={users}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default TaskBoardColumn;
