// src/components/tasks/TaskPanelItem.js
import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, AlertCircle, Clock, MessageSquare, MoreVertical, CalendarIcon, ListPlus, Trash2, Copy } from 'lucide-react';
import './TaskPanelItem.css';

const TaskPanelItem = ({ task, onClick, onToggleComplete, onQuickAction }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  // Calculate if task is overdue
  const isOverdue = task.dueDate && task.dueDate.toDate && task.status !== 'completed'
    ? task.dueDate.toDate() < new Date()
    : false;

  // Calculate if due today
  const isDueToday = task.dueDate && task.dueDate.toDate ? (() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = task.dueDate.toDate();
    return dueDate >= today && dueDate < tomorrow;
  })() : false;

  // Format due date
  const formatDueDate = (dueDate) => {
    if (!dueDate || !dueDate.toDate) return '';
    const date = dueDate.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date < today) {
      const daysOverdue = Math.ceil((today - date) / (1000 * 60 * 60 * 24));
      return `Overdue ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`;
    } else if (date >= today && date < tomorrow) {
      return 'Due today';
    } else if (date >= tomorrow) {
      const tomorrow2 = new Date(tomorrow);
      tomorrow2.setDate(tomorrow2.getDate() + 1);
      if (date < tomorrow2) {
        return 'Due tomorrow';
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return '';
  };

  // Get priority icon/color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#ef4444'; // red
      case 'high':
        return '#f97316'; // orange
      case 'medium':
        return '#3b82f6'; // blue
      case 'low':
      default:
        return '#6b7280'; // gray
    }
  };

  // Get priority label
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Medium';
    }
  };

  // Calculate subtask progress
  const subtaskProgress = task.subtasks && task.subtasks.length > 0
    ? {
        completed: task.subtasks.filter(st => st.completed).length,
        total: task.subtasks.length
      }
    : null;

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggleComplete(task.id);
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleMenuAction = (e, action) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (onQuickAction) {
      onQuickAction(task.id, action);
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <div
      className={`task-panel-item ${isOverdue ? 'task-panel-item--overdue' : ''}`}
      onClick={onClick}
    >
      <div className="task-panel-item__checkbox" onClick={handleCheckboxClick}>
        {task.status === 'completed' ? (
          <CheckSquare size={18} className="task-panel-item__checkbox-icon task-panel-item__checkbox-icon--checked" />
        ) : (
          <Square size={18} className="task-panel-item__checkbox-icon" />
        )}
      </div>

      <div className="task-panel-item__content">
        <div className="task-panel-item__header">
          <div
            className="task-panel-item__priority-indicator"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
          />
          <span className={`task-panel-item__title ${task.status === 'completed' ? 'task-panel-item__title--completed' : ''}`}>
            {task.title}
          </span>
        </div>

        <div className="task-panel-item__meta">
          {/* Due date */}
          {task.dueDate && (
            <span className={`task-panel-item__due ${isOverdue ? 'task-panel-item__due--overdue' : isDueToday ? 'task-panel-item__due--today' : ''}`}>
              <Clock size={12} />
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {/* Session/Project indicator */}
          {task.sessionId && (
            <span className="task-panel-item__context">
              {task.type === 'session' ? 'Session' : task.type}
            </span>
          )}

          {/* Comment count */}
          {task.commentCount > 0 && (
            <span className="task-panel-item__comments">
              <MessageSquare size={12} />
              {task.commentCount}
            </span>
          )}

          {/* Subtask progress */}
          {subtaskProgress && (
            <span className="task-panel-item__subtasks">
              <CheckSquare size={12} />
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          )}
        </div>
      </div>

      {isOverdue && (
        <div className="task-panel-item__overdue-icon">
          <AlertCircle size={16} />
        </div>
      )}

      {/* Three-dot menu */}
      <div className="task-panel-item__menu" ref={menuRef}>
        <button
          className="task-panel-item__menu-btn"
          onClick={handleMenuToggle}
          aria-label="Task actions"
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div className="task-panel-item__menu-dropdown">
            <button
              className="task-panel-item__menu-item"
              onClick={(e) => handleMenuAction(e, 'add-deadline')}
            >
              <CalendarIcon size={14} />
              Add deadline
            </button>
            <button
              className="task-panel-item__menu-item"
              onClick={(e) => handleMenuAction(e, 'add-subtask')}
            >
              <ListPlus size={14} />
              Add a subtask
            </button>
            <button
              className="task-panel-item__menu-item"
              onClick={(e) => handleMenuAction(e, 'duplicate')}
            >
              <Copy size={14} />
              Duplicate
            </button>
            <button
              className="task-panel-item__menu-item task-panel-item__menu-item--danger"
              onClick={(e) => handleMenuAction(e, 'delete')}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskPanelItem;
