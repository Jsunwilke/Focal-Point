// src/components/tasks/TaskBoardCard.js
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Calendar, Clock, MessageCircle, Paperclip, User, AlertCircle } from 'lucide-react';
import './TaskBoardCard.css';

const TaskBoardCard = ({ task, index, onClick, users }) => {
  const getAssignedUser = () => {
    if (!task.assignedTo || !users) return null;
    return users.find(u => u.id === task.assignedTo);
  };

  // Strip HTML tags and get plain text preview
  const getDescriptionPreview = (html) => {
    if (!html) return '';
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Get text content and truncate to ~150 characters
    const text = temp.textContent || temp.innerText || '';
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  const getPriorityClass = () => {
    switch (task.priority) {
      case 'urgent': return 'task-board-card--urgent';
      case 'high': return 'task-board-card--high';
      case 'medium': return 'task-board-card--medium';
      case 'low': return 'task-board-card--low';
      default: return '';
    }
  };

  const getDueStatus = () => {
    if (!task.dueDate) return null;

    const now = new Date();
    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const diffTime = dueDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (task.status === 'completed') return null;
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 1) return 'due-soon';
    return null;
  };

  const formatDueDate = (date) => {
    if (!date) return '';
    const dueDate = date.toDate ? date.toDate() : new Date(date);
    const today = new Date();
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays < 7) return `In ${diffDays} days`;

    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const assignedUser = getAssignedUser();
  const dueStatus = getDueStatus();

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-board-card ${getPriorityClass()} ${snapshot.isDragging ? 'task-board-card--dragging' : ''}`}
          onClick={() => onClick(task)}
        >
          <div className="task-board-card__header">
            <h4 className="task-board-card__title">{task.title}</h4>
            {dueStatus && (
              <span className={`task-board-card__due-badge task-board-card__due-badge--${dueStatus}`}>
                <AlertCircle size={12} />
              </span>
            )}
          </div>

          {task.description && (
            <p className="task-board-card__description">{getDescriptionPreview(task.description)}</p>
          )}

          <div className="task-board-card__footer">
            <div className="task-board-card__meta">
              {task.dueDate && (
                <div className={`task-board-card__due ${dueStatus ? `task-board-card__due--${dueStatus}` : ''}`}>
                  <Calendar size={12} />
                  <span>{formatDueDate(task.dueDate)}</span>
                </div>
              )}

              <div className="task-board-card__stats">
                {task.comments && task.comments.length > 0 && (
                  <div className="task-board-card__stat">
                    <MessageCircle size={12} />
                    <span>{task.comments.length}</span>
                  </div>
                )}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="task-board-card__stat">
                    <Paperclip size={12} />
                    <span>{task.attachments.length}</span>
                  </div>
                )}
                {task.timeTracked && task.timeTracked > 0 && (
                  <div className="task-board-card__stat">
                    <Clock size={12} />
                    <span>{Math.round(task.timeTracked / 60)}h</span>
                  </div>
                )}
              </div>
            </div>

            {assignedUser && (
              <div className="task-board-card__assignee">
                {assignedUser.photoURL ? (
                  <img
                    src={assignedUser.photoURL}
                    alt={`${assignedUser.firstName} ${assignedUser.lastName}`}
                    className="task-board-card__avatar"
                  />
                ) : (
                  <div className="task-board-card__avatar task-board-card__avatar--initials">
                    {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskBoardCard;
